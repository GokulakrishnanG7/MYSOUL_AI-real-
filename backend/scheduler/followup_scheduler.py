"""
Proactive Companion Engine

This is the product's signature feature: NOT reminders, relationship-building
follow-ups. Runs as a periodic background job (APScheduler, started from
main.py's lifespan) that scans every user for three independent triggers:

  1. post_event   -> an Event's event_time has passed and it hasn't been
                     followed up on yet ("You mentioned your presentation
                     yesterday. How did it go?")
  2. mood_dip     -> the user's most recent EmotionLog shows high-intensity
                     negative affect and no check-in has gone out recently
                     ("You seemed stressed recently. How are you feeling
                     today?")
  3. silence_gap  -> no messages in > followup_silence_gap_hours, softly
                     re-opens the door without being pushy.

Generated followups are written to the `followups` table with
status="pending". The frontend polls/fetches GET /followups and is
responsible for surfacing them (e.g. as the notification bell / hint bar
already built into the HTML) and marking them delivered/dismissed via
PATCH /followups/{id}.

Message generation prefers a quick LLM call (through the same
OpenRouter->Ollama failover as normal chat, so the voice stays consistent)
but always has a deterministic template fallback so a scheduler tick never
crashes or silently produces nothing just because both LLM providers are
down.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import get_settings
from database.db import SessionLocal
from database.models import Event, EmotionLog, Followup, Message, User
from services.llm_service import generate_reply

logger = logging.getLogger("mysoul.scheduler")
settings = get_settings()

_scheduler: AsyncIOScheduler | None = None


# ── Message generation ───────────────────────────────────────────────────
async def _generate_followup_text(reason: str, *, ai_name: str, context: str) -> str:
    templates = {
        "post_event": f"You mentioned {context} — how did it go? I've been thinking about you.",
        "mood_dip": "You seemed to be carrying a lot recently. How are you feeling today?",
        "silence_gap": "It's been a little while — no pressure at all, just wanted you to know I'm here whenever you feel like talking.",
        "scheduled": f"Quick check-in: {context}",
    }
    fallback = templates.get(reason, "Just checking in on you — how are things?")

    system_prompt = (
        f"You are {ai_name}, a warm, emotionally intelligent life companion. "
        f"Write ONE short, natural proactive check-in message (1-2 sentences, "
        f"no more) to send a friend you haven't spoken to in a bit. "
        f"Reason for reaching out: {reason}. Context: {context or 'none'}. "
        f"Do not sound like a notification or a bot. Do not use exclamation-heavy "
        f"corporate tone. Just the message text, nothing else."
    )
    try:
        result = await asyncio.wait_for(
            generate_reply(system_prompt, "Write the check-in message now.", history=[]),
            timeout=12,
        )
        text = (result.get("reply") or "").strip()
        return text if text else fallback
    except Exception as exc:
        logger.warning("Followup LLM generation failed, using template: %s", exc)
        return fallback


# ── Trigger scans (each takes a fresh short-lived DB session) ───────────
def _has_recent_followup(db: Session, user_id: str, reason: str, within: timedelta) -> bool:
    cutoff = datetime.utcnow() - within
    return (
        db.query(Followup)
        .filter(Followup.user_id == user_id, Followup.trigger_reason == reason, Followup.created_at >= cutoff)
        .first()
        is not None
    )


async def _scan_post_event(db: Session, user: User):
    now = datetime.utcnow()
    events = (
        db.query(Event)
        .filter(Event.user_id == user.id, Event.followed_up == False)  # noqa: E712
        .filter(Event.event_time != None)  # noqa: E711
        .filter(Event.event_time <= now)
        .all()
    )
    for event in events:
        text = await _generate_followup_text(
            "post_event", ai_name=user.ai_nickname or "MySoul", context=event.title
        )
        db.add(Followup(
            user_id=user.id,
            event_id=event.id,
            message=text,
            trigger_reason="post_event",
            status="pending",
            scheduled_for=now,
        ))
        event.followed_up = True
    if events:
        db.commit()


async def _scan_mood_dip(db: Session, user: User):
    latest = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == user.id)
        .order_by(EmotionLog.created_at.desc())
        .first()
    )
    if not latest:
        return
    is_negative_severe = (
        latest.emotion in {"sadness", "anxiety", "burnout", "loneliness", "stress", "frustration"}
        and (latest.intensity or 0) >= settings.followup_mood_dip_intensity_threshold
    )
    if not is_negative_severe:
        return
    if _has_recent_followup(db, user.id, "mood_dip", timedelta(hours=12)):
        return

    text = await _generate_followup_text("mood_dip", ai_name=user.ai_nickname or "MySoul", context=latest.emotion)
    db.add(Followup(
        user_id=user.id,
        message=text,
        trigger_reason="mood_dip",
        status="pending",
        scheduled_for=datetime.utcnow(),
    ))
    db.commit()


async def _scan_silence_gap(db: Session, user: User):
    last_message = (
        db.query(Message)
        .filter(Message.user_id == user.id)
        .order_by(Message.created_at.desc())
        .first()
    )
    if not last_message:
        return
    gap = datetime.utcnow() - last_message.created_at
    if gap < timedelta(hours=settings.followup_silence_gap_hours):
        return
    if _has_recent_followup(db, user.id, "silence_gap", timedelta(hours=settings.followup_silence_gap_hours)):
        return

    text = await _generate_followup_text("silence_gap", ai_name=user.ai_nickname or "MySoul", context="")
    db.add(Followup(
        user_id=user.id,
        message=text,
        trigger_reason="silence_gap",
        status="pending",
        scheduled_for=datetime.utcnow(),
    ))
    db.commit()


async def run_followup_scan():
    """Single scheduler tick: scans every user for all three trigger types."""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            try:
                await _scan_post_event(db, user)
                await _scan_mood_dip(db, user)
                await _scan_silence_gap(db, user)
            except Exception as exc:
                logger.error("Followup scan failed for user %s: %s", user.id, exc)
    finally:
        db.close()


def _sync_job_wrapper():
    """APScheduler's default job execution isn't async-native for every backend;
    schedule the coroutine onto the running event loop explicitly."""
    loop = asyncio.get_event_loop()
    loop.create_task(run_followup_scan())


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        run_followup_scan,
        "interval",
        seconds=settings.followup_scheduler_interval_seconds,
        id="followup_scan",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info("Proactive Companion Engine scheduler started (interval=%ss)",
                settings.followup_scheduler_interval_seconds)
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
