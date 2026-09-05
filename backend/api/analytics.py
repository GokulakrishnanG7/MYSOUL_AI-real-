"""
Analytics API — generic sink for product-analytics events (wellness tab
opens, de-stress game starts, theme toggles, etc). Not to be confused with
/dashboard, which reads emotion data for the Insights charts; this is a
write-mostly endpoint for arbitrary UI telemetry.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from analytics import analytics_service
from database.db import get_db
from database.models import AnalyticsEvent
from utils.schemas import AnalyticsEventIn

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("")
def track_event(payload: AnalyticsEventIn, db: Session = Depends(get_db)):
    row = analytics_service.log_event(
        db, user_id=payload.user_id, event_name=payload.event_name, properties=payload.properties
    )
    return {"id": row.id, "logged": True}


@router.get("")
def list_events(
    user_id: str = Query(...),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AnalyticsEvent)
        .filter(AnalyticsEvent.user_id == user_id)
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {"id": r.id, "event_name": r.event_name, "properties": r.properties, "created_at": r.created_at}
        for r in rows
    ]
