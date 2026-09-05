"""
Shared Pydantic schemas for every route in api/.

Kept in one file (rather than one per router) since MySoul's API surface is
still small enough that this stays readable, and it avoids circular imports
between routers that reference each other's response shapes (e.g. /chat
returning something /followups also shapes).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Users ────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str | None = None
    ai_nickname: str | None = None
    language: str = "en"
    mode: Literal["standard", "student", "elder"] = "standard"
    family_contact_email: str | None = None
    family_contact_phone: str | None = None
    family_contact_name: str | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    ai_nickname: str | None = None
    language: str | None = None
    mode: Literal["standard", "student", "elder"] | None = None
    family_contact_email: str | None = None
    family_contact_phone: str | None = None
    family_contact_name: str | None = None


class UserOut(BaseModel):
    id: str
    name: str | None
    ai_nickname: str | None
    language: str
    mode: str
    family_contact_email: str | None
    family_contact_phone: str | None
    family_contact_name: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Chat ─────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    user_id: str
    message: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    reply: str
    emotion: str
    confidence: float
    intensity: float
    distress: bool
    hints: list[str] = []
    provider_used: str
    degraded: bool


# ── Emotion ──────────────────────────────────────────────────────────────
class EmotionAnalyzeRequest(BaseModel):
    text: str
    user_id: str | None = None


class EmotionAnalyzeResponse(BaseModel):
    emotion: str
    confidence: float
    intensity: float


# ── Memory ───────────────────────────────────────────────────────────────
class MemoryStoreRequest(BaseModel):
    user_id: str
    content: str
    layer: Literal["long_term", "important"] = "long_term"
    category: str | None = None
    importance_score: float = 0.5


class MemoryOut(BaseModel):
    memory_id: str
    content: str
    layer: str
    category: str | None
    importance_score: float
    score: float | None = None
    created_at: str | None = None


class MemorySearchResponse(BaseModel):
    results: list[MemoryOut]


# ── Events ───────────────────────────────────────────────────────────────
class EventCreate(BaseModel):
    user_id: str
    title: str
    category: str = "general"
    event_time: datetime | None = None
    notes: str | None = None


class EventOut(BaseModel):
    id: str
    title: str
    category: str
    event_time: datetime | None
    notes: str | None
    followed_up: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Followups ────────────────────────────────────────────────────────────
class FollowupOut(BaseModel):
    id: str
    message: str
    trigger_reason: str | None
    status: str
    scheduled_for: datetime | None
    created_at: datetime
    delivered_at: datetime | None

    class Config:
        from_attributes = True


class FollowupStatusUpdate(BaseModel):
    status: Literal["delivered", "dismissed"]


# ── Tasks ────────────────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    user_id: str
    title: str
    due_at: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    is_done: bool | None = None
    due_at: datetime | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    is_done: bool
    due_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Goals ────────────────────────────────────────────────────────────────
class GoalCreate(BaseModel):
    user_id: str
    title: str
    description: str | None = None
    target_date: datetime | None = None


class GoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    progress: float | None = None
    target_date: datetime | None = None


class GoalOut(BaseModel):
    id: str
    title: str
    description: str | None
    progress: float
    target_date: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Journal (Gratitude Journal wellness tab) ────────────────────────────
class JournalCreate(BaseModel):
    user_id: str
    content: str
    prompt: str | None = None


class JournalOut(BaseModel):
    id: str
    prompt: str | None
    content: str
    emotion: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Voice ────────────────────────────────────────────────────────────────
class VoiceTranscribeResponse(BaseModel):
    text: str
    language: str | None
    duration_seconds: float | None


class VoiceSpeakRequest(BaseModel):
    text: str
    voice: str | None = None


class VoiceSpeakResponse(BaseModel):
    audio_base64: str
    mime_type: str


# ── Dashboard / Analytics ───────────────────────────────────────────────
class AnalyticsEventIn(BaseModel):
    user_id: str
    event_name: str
    properties: dict[str, Any] | None = None


class DashboardResponse(BaseModel):
    mood_wave: dict
    emotion_mix: dict
    activity_vs_mood: dict
    stress_index: dict
    best_day: dict


# ── Settings ─────────────────────────────────────────────────────────────
class SettingItem(BaseModel):
    key: str
    value: str


class SettingsBulkUpdate(BaseModel):
    user_id: str
    settings: list[SettingItem]


# ── Family / SOS alert ───────────────────────────────────────────────────
class FamilyAlertRequest(BaseModel):
    user_id: str
    reason: str = "User may need support — detected distress."


class FamilyAlertResponse(BaseModel):
    delivered: bool
    channel: str
    error: str | None = None
