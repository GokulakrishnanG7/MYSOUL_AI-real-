"""
Events API

Life events mentioned by the user (exams, interviews, presentations,
birthdays, family events). These are the raw material the Proactive
Companion Engine (scheduler/followup_scheduler.py) scans for post-event
follow-ups: "You mentioned your presentation yesterday. How did it go?"

Today the frontend has no dedicated "add event" UI, so this is mainly
populated by a future LLM-driven event-extraction pass on chat messages
(a natural extension of memory_service.extract_candidate_memory) or by
direct API calls from Student Mode's exam tracker / Elder Mode's family
memories. Exposed as full CRUD now so that UI can be wired up without
backend changes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import Event
from utils.schemas import EventCreate, EventOut

router = APIRouter(prefix="/event", tags=["events"])


@router.post("/create", response_model=EventOut)
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    event = Event(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("", response_model=list[EventOut])
def list_events(user_id: str = Query(...), db: Session = Depends(get_db)):
    return (
        db.query(Event)
        .filter(Event.user_id == user_id)
        .order_by(Event.event_time.asc().nullslast())
        .all()
    )


@router.delete("/{event_id}")
def delete_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"deleted": True}
