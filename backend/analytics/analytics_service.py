"""
Analytics Engine

Two jobs:

1. Generic event sink (`log_event`) for anything the frontend fires at
   window.SoulCore / product-analytics-style calls: wellness tab opens,
   bubble-pop-game starts, breathing sessions, theme toggles, etc.
   Stored in `analytics` as {event_name, properties}.

2. Dashboard aggregation for the Insights view, which needs data shaped
   exactly for these Chart.js canvases already in the HTML:
     - #moodChart          -> mood_wave(period)
     - #emotionMixChart    -> emotion_mix(period)
     - #activityChart      -> activity_vs_mood(period)
     - #stressArc          -> stress_index()
     - #emotionCalendar    -> emotion_calendar(year, month)
     - #bestDayName        -> best_day(period)
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from database.models import AnalyticsEvent, EmotionLog, Message

# Emotions considered "positive" for the Stress Index / Peak Day calculations.
_POSITIVE_EMOTIONS = {"joy", "gratitude", "excitement", "motivation", "calm"}
_STRESS_EMOTIONS = {"stress", "anxiety", "burnout", "frustration", "anger", "sadness", "loneliness"}


def log_event(db: Session, *, user_id: str, event_name: str, properties: dict | None = None) -> AnalyticsEvent:
    row = AnalyticsEvent(user_id=user_id, event_name=event_name, properties=properties or {})
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _period_days(period: str) -> int:
    return 30 if period == "month" else 7


def mood_wave(db: Session, *, user_id: str, period: str = "week") -> dict:
    """Average emotional 'valence' per day for the Mood Wave line chart."""
    days = _period_days(period)
    since = datetime.utcnow() - timedelta(days=days)
    logs = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == user_id, EmotionLog.created_at >= since)
        .order_by(EmotionLog.created_at.asc())
        .all()
    )
    buckets: dict[str, list[float]] = defaultdict(list)
    for log in logs:
        day_key = log.created_at.strftime("%Y-%m-%d")
        valence = log.intensity if log.emotion in _POSITIVE_EMOTIONS else -(log.intensity or 0)
        buckets[day_key].append(valence or 0.0)

    labels, values = [], []
    for i in range(days - 1, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        labels.append(day)
        vals = buckets.get(day, [])
        values.append(round(sum(vals) / len(vals), 3) if vals else 0.0)

    return {"labels": labels, "values": values}


def emotion_mix(db: Session, *, user_id: str, period: str = "week") -> dict:
    """Distribution of emotions for the Emotion Mix ring/donut chart."""
    days = _period_days(period)
    since = datetime.utcnow() - timedelta(days=days)
    logs = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == user_id, EmotionLog.created_at >= since)
        .all()
    )
    counts = Counter(log.emotion for log in logs)
    total = sum(counts.values()) or 1
    return {
        "labels": list(counts.keys()),
        "values": list(counts.values()),
        "percentages": {k: round(v / total * 100, 1) for k, v in counts.items()},
    }


def activity_vs_mood(db: Session, *, user_id: str, period: str = "week") -> dict:
    """Message volume vs. average mood valence per day, for the dual-axis chart."""
    days = _period_days(period)
    since = datetime.utcnow() - timedelta(days=days)
    messages = (
        db.query(Message)
        .filter(Message.user_id == user_id, Message.created_at >= since, Message.role == "user")
        .all()
    )
    msg_counts: dict[str, int] = defaultdict(int)
    for m in messages:
        msg_counts[m.created_at.strftime("%Y-%m-%d")] += 1

    mood = mood_wave(db, user_id=user_id, period=period)
    activity_values = [msg_counts.get(day, 0) for day in mood["labels"]]

    return {"labels": mood["labels"], "activity": activity_values, "mood": mood["values"]}


def stress_index(db: Session, *, user_id: str) -> dict:
    """0-100 stress score from the last 7 days of emotion logs, for the gauge."""
    since = datetime.utcnow() - timedelta(days=7)
    logs = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == user_id, EmotionLog.created_at >= since)
        .all()
    )
    if not logs:
        return {"score": 0, "insight": "Chat to begin tracking"}

    stress_weight = sum((log.intensity or 0) for log in logs if log.emotion in _STRESS_EMOTIONS)
    total_weight = sum((log.intensity or 0) for log in logs) or 1
    score = round((stress_weight / total_weight) * 100)

    if score >= 70:
        insight = "Stress has been running high this week — consider a breathing break."
    elif score >= 40:
        insight = "Some pressure lately, but manageable."
    else:
        insight = "You've been holding steady this week."

    return {"score": score, "insight": insight}


def best_day(db: Session, *, user_id: str, period: str = "week") -> dict:
    wave = mood_wave(db, user_id=user_id, period=period)
    if not any(wave["values"]):
        return {"day": None, "label": "Not enough data yet"}
    best_idx = max(range(len(wave["values"])), key=lambda i: wave["values"][i])
    day_str = wave["labels"][best_idx]
    day_name = datetime.strptime(day_str, "%Y-%m-%d").strftime("%A")
    return {"day": day_str, "label": day_name}


def emotion_calendar(db: Session, *, user_id: str, year: int, month: int) -> dict:
    """Dominant emotion per calendar day, for the #emotionCalendar grid."""
    start = datetime(year, month, 1)
    end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
    logs = (
        db.query(EmotionLog)
        .filter(EmotionLog.user_id == user_id, EmotionLog.created_at >= start, EmotionLog.created_at < end)
        .all()
    )
    by_day: dict[str, Counter] = defaultdict(Counter)
    for log in logs:
        by_day[log.created_at.strftime("%Y-%m-%d")][log.emotion] += 1

    days = {}
    for day_str, counter in by_day.items():
        dominant = counter.most_common(1)[0][0]
        days[day_str] = dominant

    return {"year": year, "month": month, "days": days}
