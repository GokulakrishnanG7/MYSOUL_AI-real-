"""
Settings API — server-side key/value mirror of the frontend's localStorage
`ms_setup` blob, so preferences survive a cleared browser / new device.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime

from database.db import get_db
from database.models import Setting
from utils.schemas import SettingsBulkUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def get_settings_for_user(user_id: str = Query(...), db: Session = Depends(get_db)):
    rows = db.query(Setting).filter(Setting.user_id == user_id).all()
    return {r.key: r.value for r in rows}


@router.post("")
def upsert_settings(payload: SettingsBulkUpdate, db: Session = Depends(get_db)):
    for item in payload.settings:
        row = (
            db.query(Setting)
            .filter(Setting.user_id == payload.user_id, Setting.key == item.key)
            .first()
        )
        if row:
            row.value = item.value
            row.updated_at = datetime.utcnow()
        else:
            db.add(Setting(user_id=payload.user_id, key=item.key, value=item.value))
    db.commit()
    return {"saved": True}
