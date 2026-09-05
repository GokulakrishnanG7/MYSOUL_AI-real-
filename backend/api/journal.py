"""
Journal API — backs the wellness tab's Gratitude Journal panel
(#wpanel-journal / #journalInput / #journalEntries). Runs each entry through
the Emotion Engine on save so journal mood also feeds the Mood Wave/Calendar.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import EmotionLog, JournalEntry
from emotion.emotion_engine import get_emotion_engine
from utils.schemas import JournalCreate, JournalOut

router = APIRouter(prefix="/journal", tags=["journal"])


@router.post("", response_model=JournalOut)
def create_entry(payload: JournalCreate, db: Session = Depends(get_db)):
    emotion_result = get_emotion_engine().analyze(payload.content)

    entry = JournalEntry(
        user_id=payload.user_id,
        prompt=payload.prompt,
        content=payload.content,
        emotion=emotion_result["emotion"],
    )
    db.add(entry)
    db.add(EmotionLog(
        user_id=payload.user_id,
        emotion=emotion_result["emotion"],
        confidence=emotion_result["confidence"],
        intensity=emotion_result["intensity"],
    ))
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=list[JournalOut])
def list_entries(user_id: str = Query(...), db: Session = Depends(get_db)):
    return (
        db.query(JournalEntry)
        .filter(JournalEntry.user_id == user_id)
        .order_by(JournalEntry.created_at.desc())
        .all()
    )


@router.delete("/{entry_id}")
def delete_entry(entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    db.delete(entry)
    db.commit()
    return {"deleted": True}
