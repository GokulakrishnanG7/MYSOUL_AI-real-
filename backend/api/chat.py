"""
Chat API

The single most important endpoint: everything else in the backend exists to
feed or be fed by this. On every user message it:

  1. Runs the Emotion Engine (emotion/emotion_engine.py) on the raw text.
  2. Runs the Distress Detector (safety/distress_detector.py) — if triggered,
     the frontend's existing #sosOverlay is shown (SoulCore.onDistress).
  3. Pulls SHORT_TERM memory (last N messages in this conversation) and
     LONG_TERM/IMPORTANT memory (semantic FAISS search) relevant to the
     message.
  4. Builds the system prompt via the Personality Engine (70/20/10 blend).
  5. Calls the LLM service (OpenRouter -> Ollama failover, never crashes).
  6. Persists both messages, an EmotionLog row, and (if the heuristic
     extractor finds something durable) a new Memory row.
  7. Returns contextual "hints" the frontend's #hintBar already knows how to
     render (it looks for the words "breath", "journal", "meditat" in the
     hint text to pick an action button — see the inline script in your HTML).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import Conversation, EmotionLog, Message, User
from emotion.emotion_engine import get_emotion_engine
from memory import memory_service
from personality.personality_engine import build_system_prompt
from safety.distress_detector import check_distress
from services.llm_service import generate_reply
from utils.schemas import ChatRequest, ChatResponse

logger = logging.getLogger("mysoul.chat")
router = APIRouter(tags=["chat"])

SHORT_TERM_WINDOW = 12  # last N messages pulled as LLM history


def _build_hints(emotion: str, distress: bool) -> list[str]:
    if distress:
        return ["Try a breathing exercise to help ground yourself right now."]
    hints_by_emotion = {
        "stress": ["A short breathing exercise might help take the edge off."],
        "anxiety": ["Want to try a slow breathing exercise together?"],
        "burnout": ["Sounds like you're running low — maybe rest before anything else."],
        "sadness": ["Writing a line in your journal might help you process this."],
        "loneliness": ["I'm here. Want to talk more, or just sit with this for a moment?"],
        "gratitude": ["This might be a nice moment to jot down in your gratitude journal."],
        "calm": ["A short meditation could help you stay in this space."],
    }
    return hints_by_emotion.get(emotion, [])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # ── Conversation ────────────────────────────────────────────────────
    conversation = None
    if payload.conversation_id:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == payload.conversation_id, Conversation.user_id == user.id)
            .first()
        )
    if not conversation:
        conversation = Conversation(user_id=user.id, title=payload.message[:60])
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # ── Emotion + distress ──────────────────────────────────────────────
    emotion_result = get_emotion_engine().analyze(payload.message)
    distress_result = check_distress(payload.message, emotion_result)
    if distress_result["distress"]:
        logger.warning("Distress flagged for user=%s reason=%s", user.id, distress_result["reason"])

    # ── Memory retrieval (long_term / important via FAISS) ──────────────
    try:
        memory_snippets = memory_service.get_memory_snippets_for_prompt(
            db, user_id=user.id, query=payload.message, top_k=5
        )
    except Exception as exc:
        logger.error("Memory search failed, continuing without it: %s", exc)
        memory_snippets = []

    # ── Short-term memory: last N messages in this conversation ─────────
    recent_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(SHORT_TERM_WINDOW)
        .all()
    )
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(recent_messages)
    ]

    system_prompt = build_system_prompt(
        user_name=user.name,
        ai_name=user.ai_nickname,
        emotion=emotion_result["emotion"],
        memory_snippets=memory_snippets,
        mode=user.mode,
    )

    llm_result = await generate_reply(system_prompt, payload.message, history=history)

    # ── Persist user message ─────────────────────────────────────────────
    user_msg = Message(
        conversation_id=conversation.id,
        user_id=user.id,
        role="user",
        content=payload.message,
        emotion=emotion_result["emotion"],
        intensity=emotion_result["intensity"],
    )
    db.add(user_msg)
    db.flush()

    db.add(EmotionLog(
        user_id=user.id,
        message_id=user_msg.id,
        emotion=emotion_result["emotion"],
        confidence=emotion_result["confidence"],
        intensity=emotion_result["intensity"],
    ))

    # ── Persist assistant message ────────────────────────────────────────
    assistant_msg = Message(
        conversation_id=conversation.id,
        user_id=user.id,
        role="assistant",
        content=llm_result["reply"],
        provider_used=llm_result["provider_used"],
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    # ── Heuristic memory extraction (fast-path safety net) ───────────────
    try:
        candidate = memory_service.extract_candidate_memory(payload.message)
        if candidate:
            memory_service.store_memory(
                db,
                user_id=user.id,
                content=candidate["content"],
                category=candidate["category"],
                importance_score=candidate["importance_score"],
                source_message_id=user_msg.id,
            )
    except Exception as exc:
        logger.error("Memory extraction/store failed: %s", exc)

    hints = _build_hints(emotion_result["emotion"], distress_result["distress"])

    return ChatResponse(
        conversation_id=conversation.id,
        message_id=assistant_msg.id,
        reply=llm_result["reply"],
        emotion=emotion_result["emotion"],
        confidence=emotion_result["confidence"],
        intensity=emotion_result["intensity"],
        distress=distress_result["distress"],
        hints=hints,
        provider_used=llm_result["provider_used"],
        degraded=llm_result["degraded"],
    )
