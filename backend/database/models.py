"""
All database tables for MySoul AI.

Design notes:
- Every table has a `user_id` because the frontend is single-tenant-per-device
  today (localStorage `ms_setup`) but multi-user from day one on the backend,
  so switching to real accounts later needs zero schema changes.
- `created_at` is on every row for analytics/timelines (matches the frontend's
  "SOUL TIMELINE" and "EMOTION CALENDAR" widgets).
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship

from database.db import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=True)                # setup.user_name
    ai_nickname = Column(String, nullable=True)          # setup.ai_name / ms_ai_nick
    language = Column(String, default="en")              # setup.language
    mode = Column(String, default="standard")            # standard | student | elder
    email = Column(String, nullable=True, unique=False, index=True)
    hashed_passcode = Column(String, nullable=True)       # optional lightweight auth
    family_contact_email = Column(String, nullable=True)
    family_contact_phone = Column(String, nullable=True)
    family_contact_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversations = relationship("Conversation", back_populates="user")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    title = Column(String, nullable=True)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    """Short-term memory lives here: the raw conversation log."""
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=gen_id)
    conversation_id = Column(String, ForeignKey("conversations.id"), index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    role = Column(String)                 # "user" | "assistant"
    content = Column(Text)
    emotion = Column(String, nullable=True)
    intensity = Column(Float, nullable=True)
    provider_used = Column(String, nullable=True)         # "openrouter" | "ollama" | "none"
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    conversation = relationship("Conversation", back_populates="messages")


class Memory(Base):
    """
    Unified memory table for LONG_TERM and IMPORTANT memory layers.
    `layer` distinguishes them: "long_term" | "important".
    (SHORT_TERM memory is just the last N rows of `messages`, not stored here.)
    """
    __tablename__ = "memories"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    layer = Column(String, default="long_term")          # long_term | important
    category = Column(String, nullable=True)              # goal | preference | life_event | birthday | exam | achievement...
    content = Column(Text)
    importance_score = Column(Float, default=0.5)         # 0..1, drives promotion to "important"
    source_message_id = Column(String, ForeignKey("messages.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)           # e.g. exam date, after which relevance decays


class MemoryEmbedding(Base):
    """
    Maps a memory/message to its position in the FAISS vector index so we can
    reconstruct text from a FAISS search hit. FAISS stores vectors only, not
    text - this table is the source of truth for the text + metadata.
    """
    __tablename__ = "memory_embeddings"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    memory_id = Column(String, ForeignKey("memories.id"), nullable=True)
    faiss_index_position = Column(Integer, index=True)     # row id inside the FAISS index
    text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmotionLog(Base):
    """Every emotion detection result, used for Mood Wave / Emotion Mix / Calendar / Stress Index."""
    __tablename__ = "emotion_logs"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    message_id = Column(String, ForeignKey("messages.id"), nullable=True)
    emotion = Column(String, index=True)
    confidence = Column(Float)
    intensity = Column(Float)
    raw_scores = Column(JSON, nullable=True)               # full distribution, for debugging/analytics
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Event(Base):
    """Life events the user mentions: exams, interviews, birthdays, presentations..."""
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    title = Column(String)
    category = Column(String, default="general")           # exam | interview | birthday | presentation | family | other
    event_time = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    source_message_id = Column(String, ForeignKey("messages.id"), nullable=True)
    followed_up = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Followup(Base):
    """Proactive companion engine output: relationship-building check-ins."""
    __tablename__ = "followups"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    event_id = Column(String, ForeignKey("events.id"), nullable=True)
    message = Column(Text)
    trigger_reason = Column(String, nullable=True)         # "post_event" | "mood_dip" | "silence_gap" | "scheduled"
    status = Column(String, default="pending")              # pending | delivered | dismissed
    scheduled_for = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    delivered_at = Column(DateTime, nullable=True)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    title = Column(String)
    is_done = Column(Boolean, default=False)
    due_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Goal(Base):
    __tablename__ = "goals"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    title = Column(String)
    description = Column(Text, nullable=True)
    progress = Column(Float, default=0.0)                   # 0..1
    target_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class VoiceLog(Base):
    __tablename__ = "voice_logs"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    direction = Column(String)                              # "stt" | "tts"
    transcript = Column(Text, nullable=True)
    audio_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AnalyticsEvent(Base):
    """Generic product-analytics sink: button clicks, view switches, game usage."""
    __tablename__ = "analytics"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    event_name = Column(String, index=True)                 # e.g. "wellness_tab_open", "bubble_pop_game_start"
    properties = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Setting(Base):
    """Per-user key/value settings (mirrors localStorage ms_setup, but server-side)."""
    __tablename__ = "settings"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    key = Column(String, index=True)
    value = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow)


class JournalEntry(Base):
    """Gratitude Journal (wellness tab) entries."""
    __tablename__ = "journal_entries"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    prompt = Column(String, nullable=True)
    content = Column(Text)
    emotion = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class FamilyAlert(Base):
    """SOS overlay -> 'Alert a Family Member' delivery log."""
    __tablename__ = "family_alerts"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    reason = Column(Text, nullable=True)
    channel = Column(String, nullable=True)                 # email | sms | console
    delivered = Column(Boolean, default=False)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
