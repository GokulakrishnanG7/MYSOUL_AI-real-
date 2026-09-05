"""
Followups API

Read/update access to what the Proactive Companion Engine
(scheduler/followup_scheduler.py) generates in the background. The frontend
already has a notification bell (#notifBtn / #notifDot) and hint bar
(#hintBar) — GET /followups is what would drive the notif dot's badge count,
and PATCH marks one delivered (shown) or dismissed (user closed it).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime

from database.db import get_db
from database.models import Followup
from utils.schemas import FollowupOut, FollowupStatusUpdate

router = APIRouter(prefix="/followups", tags=["followups"])


@router.get("", response_model=list[FollowupOut])
def list_followups(
    user_id: str = Query(...),
    status: str | None = Query(None, description="Filter by status: pending | delivered | dismissed"),
    db: Session = Depends(get_db),
):
    q = db.query(Followup).filter(Followup.user_id == user_id)
    if status:
        q = q.filter(Followup.status == status)
    return q.order_by(Followup.created_at.desc()).all()


@router.patch("/{followup_id}", response_model=FollowupOut)
def update_followup_status(followup_id: str, payload: FollowupStatusUpdate, db: Session = Depends(get_db)):
    followup = db.query(Followup).filter(Followup.id == followup_id).first()
    if not followup:
        raise HTTPException(status_code=404, detail="Followup not found")
    followup.status = payload.status
    if payload.status == "delivered":
        followup.delivered_at = datetime.utcnow()
    db.commit()
    db.refresh(followup)
    return followup
