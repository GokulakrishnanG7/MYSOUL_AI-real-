"""
Emotion Engine V2

Model choice: SamLowe/roberta-base-go_emotions
─────────────────────────────────────────────
This is fine-tuned on Google's GoEmotions dataset (58k Reddit comments,
28 emotion labels). It was chosen over a plain DistilBERT sentiment model or
the more common 7-class "j-hartmann/emotion-english-distilroberta-base"
because your frontend needs a MUCH richer emotional vocabulary (gratitude,
excitement, loneliness-adjacent signals, confusion, nervousness) — GoEmotions
is the only widely-used open model with that granularity.

No off-the-shelf model natively outputs "burnout" or "loneliness" (these are
compound psychological states, not single-utterance emotions), so this engine
runs the GoEmotions classifier FIRST, maps its output onto your 14-label
taxonomy, then runs a lightweight secondary heuristic pass that can upgrade
the result to "burnout" or "loneliness" when specific linguistic patterns
co-occur with negative-affect emotions. This mirrors how production emotion
systems layer a statistical model with domain rules — treat the heuristic
list as a v1 you should refine with real user data over time.

Output contract (matches your spec exactly):
{
  "emotion": str,
  "confidence": float,   # 0..1, softmax prob of the winning GoEmotions label
  "intensity": float     # 0..1, drives the frontend's Intensity Ring + Mood Ring
}
"""
from __future__ import annotations

import re
import threading
from functools import lru_cache

from transformers import pipeline

from config import get_settings

settings = get_settings()

# ── GoEmotions (28 labels) → MySoul's 14-label taxonomy ────────────────────
GOEMOTIONS_TO_MYSOUL = {
    "admiration": "joy",
    "amusement": "joy",
    "approval": "motivation",
    "caring": "calm",
    "desire": "motivation",
    "excitement": "excitement",
    "gratitude": "gratitude",
    "joy": "joy",
    "love": "joy",
    "optimism": "motivation",
    "pride": "motivation",
    "relief": "calm",
    "surprise": "confusion",
    "curiosity": "confusion",
    "realization": "confusion",
    "confusion": "confusion",
    "neutral": "neutral",
    "anger": "anger",
    "annoyance": "frustration",
    "disapproval": "frustration",
    "disappointment": "sadness",
    "disgust": "frustration",
    "embarrassment": "anxiety",
    "fear": "anxiety",
    "nervousness": "anxiety",
    "grief": "sadness",
    "remorse": "sadness",
    "sadness": "sadness",
}

MYSOUL_EMOTIONS = {
    "joy", "gratitude", "excitement", "motivation", "calm", "neutral",
    "stress", "anxiety", "loneliness", "frustration", "burnout",
    "sadness", "anger", "confusion",
}

# ── Secondary heuristic layer: catches states GoEmotions can't see ─────────
# Kept intentionally simple/transparent (word-boundary regex, no external
# calls) so it's easy for you to extend as you collect real usage data.
_BURNOUT_PATTERNS = re.compile(
    r"\b(burn(ed|t)? out|burnout|so (exhausted|drained)|can'?t keep (going|up)|"
    r"no energy left|running on empty|nothing left to give)\b", re.I,
)
_LONELINESS_PATTERNS = re.compile(
    r"\b(lonely|loneliness|no ?one (to talk to|understands|checks on me)|"
    r"all by myself|isolated|feel so alone|nobody (cares|calls))\b", re.I,
)
_STRESS_PATTERNS = re.compile(
    r"\b(stressed|overwhelmed|so much pressure|can'?t handle (it|this)|"
    r"too much (to do|going on)|deadline)\b", re.I,
)

_NEGATIVE_BASE_EMOTIONS = {"sadness", "anxiety", "frustration", "anger"}


class EmotionEngine:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        # Loaded once, kept in memory for the life of the process.
        self._classifier = pipeline(
            task="text-classification",
            model=settings.emotion_model_name,
            top_k=None,               # return full distribution, we need it for intensity
            device=-1 if settings.emotion_device == "cpu" else 0,
        )

    @classmethod
    def get(cls) -> "EmotionEngine":
        # Thread-safe singleton so the (heavy) model loads exactly once.
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def analyze(self, text: str) -> dict:
        if not text or not text.strip():
            return {"emotion": "neutral", "confidence": 1.0, "intensity": 0.0}

        raw = self._classifier(text[:512])[0]           # list[{"label", "score"}]
        raw.sort(key=lambda x: x["score"], reverse=True)
        top = raw[0]

        mapped_emotion = GOEMOTIONS_TO_MYSOUL.get(top["label"], "neutral")
        confidence = float(top["score"])

        # Intensity: how far the winning label pulls above a "neutral" split
        # across the distribution. Simple, monotonic, easy to reason about.
        intensity = self._compute_intensity(raw, mapped_emotion)

        # Heuristic upgrade pass for compound states not present in GoEmotions
        mapped_emotion = self._apply_heuristics(text, mapped_emotion, intensity)

        return {
            "emotion": mapped_emotion,
            "confidence": round(confidence, 4),
            "intensity": round(intensity, 4),
        }

    @staticmethod
    def _compute_intensity(raw_scores: list[dict], mapped_emotion: str) -> float:
        if mapped_emotion == "neutral":
            # Intensity of "neutral" is inverse to how confidently non-neutral
            # everything else scored.
            neutral_score = next((r["score"] for r in raw_scores if r["label"] == "neutral"), 0.0)
            return max(0.0, 1.0 - neutral_score)
        top_score = raw_scores[0]["score"]
        return min(1.0, top_score * 1.15)   # slight boost so mid-confidence still reads as "felt"

    @staticmethod
    def _apply_heuristics(text: str, mapped_emotion: str, intensity: float) -> str:
        if _BURNOUT_PATTERNS.search(text) and mapped_emotion in _NEGATIVE_BASE_EMOTIONS | {"neutral"}:
            return "burnout"
        if _LONELINESS_PATTERNS.search(text) and mapped_emotion in _NEGATIVE_BASE_EMOTIONS | {"neutral"}:
            return "loneliness"
        if _STRESS_PATTERNS.search(text) and mapped_emotion in {"anxiety", "frustration", "neutral"} and intensity > 0.4:
            return "stress"
        return mapped_emotion


@lru_cache
def get_emotion_engine() -> EmotionEngine:
    return EmotionEngine.get()
