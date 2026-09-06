"""
Frontend Compatibility API

Your actual frontend (scripts/soul-core.js, voice.js) was already written
against a specific contract BEFORE this backend existed:

    POST /api/chat        {user_id, text, language, user_name, ai_name}
                       -> {response, emotion, intensity, pattern, context,
                           urgency, hints, errors, emotion_state}

    POST /api/chat/voice  multipart: audio, user_id, language
                       -> {transcript, response, emotion, intensity, ...}

    POST /api/alerts/family  {user_id, emotion, urgency, note, timestamp}
                       -> 200 OK (soul-core.js only checks r.ok)

Rather than rewriting soul-core.js/voice.js/chat.js (risky — the whole app
is built on their exact behavior), this router adapts the "real" backend
(api/chat.py, api/voice.py, api/alerts.py) to match that contract exactly,
so your existing frontend JS works completely unmodified.

Key differences this layer bridges:
  - URL prefix: frontend calls /api/*, core backend serves bare paths.
  - Field names: text<->message, response<->reply, intensity as a STRING
    ("low"/"medium"/"high") not a float.
  - Emotion vocabulary: the frontend's EDEFS taxonomy (13 labels incl.
    "distress", "happy", "academic") differs from the Emotion Engine's
    14-label taxonomy (e.g. "gratitude", "burnout", "confusion") -> mapped
    via EMOTION_ENGINE_TO_FRONTEND below.
  - No user pre-registration: the frontend invents `user_id` in
    localStorage and starts chatting immediately with no signup step, so
    this layer auto-creates a User row on first contact instead of 404ing.
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import Conversation, EmotionLog, Message, User
from emotion.emotion_engine import get_emotion_engine
from memory import memory_service
from personality.personality_engine import build_system_prompt
from safety.alerts import send_family_alert
from safety.distress_detector import check_distress
from services.llm_service import generate_reply
from voice import voice_service

logger = logging.getLogger("mysoul.compat")
router = APIRouter(prefix="/api", tags=["frontend-compat"])

SHORT_TERM_WINDOW = 12

# Emotion Engine's 14 labels -> the frontend's EDEFS keys (soul-core.js)
EMOTION_ENGINE_TO_FRONTEND = {
    "joy": "joy",
    "gratitude": "happy",
    "excitement": "surprised",
    "motivation": "happy",
    "calm": "calm",
    "neutral": "neutral",
    "stress": "stressed",
    "anxiety": "anxious",
    "loneliness": "sad",
    "frustration": "angry",
    "burnout": "stressed",
    "sadness": "sad",
    "anger": "angry",
    "confusion": "neutral",
}

FRONTEND_HINTS = {
    "stressed": ["Take three slow breaths", "Break the next task into one small step"],
    "anxious": ["Try box breathing", "Name five things you can see"],
    "sad": ["Reach out to someone you trust", "Writing down what you feel may help"],
    "angry": ["Pause before responding", "A short walk can help release tension"],
    "distress": ["Please reach out to someone you trust right now", "You do not have to face this alone"],
    "fear": ["Focus on what you can control right now", "Name the feeling without judging it"],
    "calm": ["This is a good moment to journal or reflect"],
    "joy": ["Capture this feeling and what created it"],
    "happy": ["Notice what is making you smile today"],
    "neutral": ["Take a moment to check in with yourself"],
}

FRONTEND_COLORS = {
    "neutral": "#00c8ff", "joy": "#ffe040", "happy": "#ffe040", "calm": "#38f098",
    "sad": "#00c8ff", "angry": "#ffe040", "stressed": "#ffe040", "fear": "#00c8ff",
    "love": "#38f098", "surprised": "#ffe040", "distress": "#00c8ff", "anxious": "#00c8ff",
    "academic": "#38f098",
}


def _intensity_label(value: float) -> str:
    if value >= 0.7:
        return "high"
    if value >= 0.34:
        return "medium"
    return "low"


def _get_or_create_user(db: Session, user_id: str, *, name: str | None, ai_nickname: str | None, language: str) -> User:
    """The frontend never calls POST /users — it invents an id in
    localStorage and starts chatting. So unlike the 'real' /chat endpoint
    (which 404s on an unknown user), this compat layer creates one on the
    fly using the given id as the primary key."""
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        changed = False
        if name is not None and user.name != name:
            user.name = name
            changed = True
        if ai_nickname is not None and user.ai_nickname != ai_nickname:
            user.ai_nickname = ai_nickname
            changed = True
        if language and user.language != language:
            user.language = language
            changed = True
        if changed:
            db.commit()
            db.refresh(user)
        return user
    user = User(id=user_id, name=name, ai_nickname=ai_nickname, language=language)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


async def _run_chat_turn(db: Session, *, user: User, text: str) -> dict:
    """Shared logic between /api/chat (text) and /api/chat/voice (after STT)."""
    conversation = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.started_at.desc())
        .first()
    )
    if not conversation:
        conversation = Conversation(user_id=user.id, title=text[:60])
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    emotion_result = get_emotion_engine().analyze(text)
    distress_result = check_distress(text, emotion_result)

    try:
        memory_snippets = memory_service.get_memory_snippets_for_prompt(
            db, user_id=user.id, query=text, top_k=5
        )
    except Exception as exc:
        logger.error("Memory search failed, continuing without it: %s", exc)
        memory_snippets = []

    recent_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(SHORT_TERM_WINDOW)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in reversed(recent_messages)]

    system_prompt = build_system_prompt(
        user_name=user.name,
        ai_name=user.ai_nickname,
        emotion=emotion_result["emotion"],
        memory_snippets=memory_snippets,
        mode=user.mode,
    )
    llm_result = await generate_reply(system_prompt, text, history=history)

    user_msg = Message(
        conversation_id=conversation.id, user_id=user.id, role="user",
        content=text, emotion=emotion_result["emotion"], intensity=emotion_result["intensity"],
    )
    db.add(user_msg)
    db.flush()
    db.add(EmotionLog(
        user_id=user.id, message_id=user_msg.id, emotion=emotion_result["emotion"],
        confidence=emotion_result["confidence"], intensity=emotion_result["intensity"],
    ))
    db.add(Message(
        conversation_id=conversation.id, user_id=user.id, role="assistant",
        content=llm_result["reply"], provider_used=llm_result["provider_used"],
    ))
    db.commit()

    try:
        candidate = memory_service.extract_candidate_memory(text)
        if candidate:
            memory_service.store_memory(
                db, user_id=user.id, content=candidate["content"],
                category=candidate["category"], importance_score=candidate["importance_score"],
                source_message_id=user_msg.id,
            )
    except Exception as exc:
        logger.error("Memory extraction/store failed: %s", exc)

    frontend_emotion = "distress" if distress_result["distress"] else EMOTION_ENGINE_TO_FRONTEND.get(
        emotion_result["emotion"], "neutral"
    )
    intensity = _intensity_label(emotion_result["intensity"])

    return {
        "response": llm_result["reply"],
        "emotion": frontend_emotion,
        "intensity": intensity,
        "pattern": None,
        "context": None,
        "urgency": "high" if distress_result["distress"] else None,
        "hints": FRONTEND_HINTS.get(frontend_emotion, FRONTEND_HINTS["neutral"]),
        "emotion_state": {
            "color": FRONTEND_COLORS.get(frontend_emotion, FRONTEND_COLORS["neutral"]),
            "label": frontend_emotion.replace("_", " ").upper(),
        },
        "errors": [],
    }


class CompatChatRequest(BaseModel):
    user_id: str
    text: str
    language: str = "en"
    user_name: str | None = None
    ai_name: str | None = None


@router.post("/chat")
async def compat_chat(payload: CompatChatRequest, db: Session = Depends(get_db)):
    user = _get_or_create_user(
        db, payload.user_id, name=payload.user_name, ai_nickname=payload.ai_name, language=payload.language
    )
    return await _run_chat_turn(db, user=user, text=payload.text)


@router.post("/chat/voice")
async def compat_chat_voice(
    audio: UploadFile = File(...),
    user_id: str = Form(...),
    language: str = Form("en"),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(db, user_id, name=None, ai_nickname=None, language=language)

    audio_bytes = await audio.read()
    suffix = "." + (audio.filename.rsplit(".", 1)[-1] if audio.filename and "." in audio.filename else "webm")
    stt_result = voice_service.transcribe_audio_bytes(audio_bytes, suffix=suffix)
    transcript = stt_result["text"]

    if not transcript.strip():
        return {
            "transcript": "",
            "response": "I couldn't quite catch that — could you try again?",
            "emotion": "neutral", "intensity": "low", "pattern": None,
            "context": None, "urgency": None, "hints": FRONTEND_HINTS["neutral"],
            "emotion_state": {"color": FRONTEND_COLORS["neutral"], "label": "NEUTRAL"},
            "errors": ["empty_transcript"],
        }

    result = await _run_chat_turn(db, user=user, text=transcript)
    result["transcript"] = transcript
    return result


class CompatFamilyAlertRequest(BaseModel):
    user_id: str
    emotion: str | None = None
    urgency: str | None = None
    note: str = ""
    timestamp: str | None = None


@router.post("/alerts/family")
async def compat_family_alert(payload: CompatFamilyAlertRequest, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, payload.user_id, name=None, ai_nickname=None, language="en")
    reason = payload.note or f"User may need support (emotion={payload.emotion}, urgency={payload.urgency})"
    result = await send_family_alert(db, user, reason)
    return result
