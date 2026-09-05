"""
Dashboard API

Feeds the Insights view's Chart.js canvases directly (see analytics/
analytics_service.py for the shape of each response and which frontend
element it maps to).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from analytics import analytics_service
from database.db import get_db
from utils.schemas import DashboardResponse

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    user_id: str = Query(...),
    period: str = Query("week", pattern="^(week|month)$"),
    db: Session = Depends(get_db),
):
    return DashboardResponse(
        mood_wave=analytics_service.mood_wave(db, user_id=user_id, period=period),
        emotion_mix=analytics_service.emotion_mix(db, user_id=user_id, period=period),
        activity_vs_mood=analytics_service.activity_vs_mood(db, user_id=user_id, period=period),
        stress_index=analytics_service.stress_index(db, user_id=user_id),
        best_day=analytics_service.best_day(db, user_id=user_id, period=period),
    )


@router.get("/dashboard/calendar")
def dashboard_calendar(
    user_id: str = Query(...),
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    return analytics_service.emotion_calendar(db, user_id=user_id, year=year, month=month)
