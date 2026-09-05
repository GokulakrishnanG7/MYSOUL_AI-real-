"""
Alerts API — backs the SOS overlay's "Alert a Family Member" button
(SoulCore.sendFamilyAlert(reason) in the frontend). See safety/alerts.py for
the pluggable console/SMTP/Twilio delivery providers.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User
from safety.alerts import send_family_alert
from utils.schemas import FamilyAlertRequest, FamilyAlertResponse

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("/family", response_model=FamilyAlertResponse)
async def alert_family(payload: FamilyAlertRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await send_family_alert(db, user, payload.reason)
    return FamilyAlertResponse(**result)
