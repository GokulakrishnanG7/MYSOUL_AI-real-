"""
Emotion API

Standalone access to the Emotion Engine, independent of /chat — used for the
Mood Ring / Soul Bubble to react to typed-but-not-yet-sent text, journal
entries, or anywhere the frontend wants an emotion read without generating a
full conversational reply.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import EmotionLog
from emotion.emotion_engine import get_emotion_engine
from utils.schemas import EmotionAnalyzeRequest, EmotionAnalyzeResponse

router = APIRouter(prefix="/emotion", tags=["emotion"])


@router.post("/analyze", response_model=EmotionAnalyzeResponse)
def analyze_emotion(payload: EmotionAnalyzeRequest, db: Session = Depends(get_db)):
    result = get_emotion_engine().analyze(payload.text)

    if payload.user_id:
        db.add(EmotionLog(
            user_id=payload.user_id,
            emotion=result["emotion"],
            confidence=result["confidence"],
            intensity=result["intensity"],
        ))
        db.commit()

    return EmotionAnalyzeResponse(**result)
