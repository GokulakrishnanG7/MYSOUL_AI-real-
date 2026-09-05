"""
Distress Detector

Decides when the backend should set `distress: true` on a /chat response so
the frontend shows its existing SOS overlay (#sosOverlay) — the one with the
iCall helpline and "Alert a Family Member" / "Start Breathing Exercise"
buttons that's already built into your HTML.

This is a SAFETY layer, not a diagnostic one: it is deliberately tuned to be
sensitive (biased toward false positives) because the cost of an unnecessary
supportive prompt is low, while missing a real crisis is not acceptable.

Two independent signals combine:
  1. Emotion signal: emotion_engine output shows severe, high-intensity
     negative affect (sadness/anxiety/burnout at high intensity).
  2. Language signal: the message contains direct crisis language.

Either signal alone is enough to trigger. This module intentionally does NOT
attempt to enumerate or explain every phrase pattern it matches — that's a
maintenance and safety concern, not just a code-style one. Treat this as a
starting point: pair it with a proper moderation/classifier API
(e.g. a hosted safety-classification endpoint) before production use with
real users, and have a licensed mental-health professional review the
thresholds and the SOS copy.
"""
import re

HIGH_RISK_INTENSITY_THRESHOLD = 0.75
HIGH_RISK_EMOTIONS = {"sadness", "anxiety", "burnout", "loneliness"}

# Deliberately kept short and high-precision. Extend cautiously; false
# negatives here matter far more than false positives.
_CRISIS_PATTERNS = re.compile(
    r"\b(want to die|kill myself|end (my|it) all|no reason to (live|go on)|"
    r"suicid\w*|self.?harm|hurt myself|can'?t go on|better off (dead|without me))\b",
    re.I,
)


def check_distress(text: str, emotion_result: dict) -> dict:
    """
    Returns: {"distress": bool, "reason": str | None}
    `reason` is for internal logging only — never surface detection mechanics
    to the end user, just show the supportive SOS UI.
    """
    if _CRISIS_PATTERNS.search(text or ""):
        return {"distress": True, "reason": "language_signal"}

    emotion = emotion_result.get("emotion")
    intensity = emotion_result.get("intensity", 0.0)
    if emotion in HIGH_RISK_EMOTIONS and intensity >= HIGH_RISK_INTENSITY_THRESHOLD:
        return {"distress": True, "reason": "emotion_signal"}

    return {"distress": False, "reason": None}
