"""
Voice API

Backs the frontend's mic button (#micBtn -> STT) and AI speaking bar
(#aiSpeakBar -> TTS). See voice/voice_service.py for the Whisper/edge-tts
implementation details and why wake-word/continuous-listening aren't built
here (the frontend explicitly disabled that feature).
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import VoiceLog
from utils.schemas import VoiceSpeakRequest, VoiceSpeakResponse, VoiceTranscribeResponse
from voice import voice_service

router = APIRouter(prefix="/voice", tags=["voice"])

MAX_AUDIO_BYTES = 15 * 1024 * 1024  # 15MB safety cap


@router.post("/transcribe", response_model=VoiceTranscribeResponse)
async def transcribe(
    audio: UploadFile = File(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db),
):
    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large")

    suffix = "." + (audio.filename.rsplit(".", 1)[-1] if audio.filename and "." in audio.filename else "webm")
    result = voice_service.transcribe_audio_bytes(audio_bytes, suffix=suffix)

    db.add(VoiceLog(
        user_id=user_id,
        direction="stt",
        transcript=result["text"],
        audio_seconds=result.get("duration_seconds"),
    ))
    db.commit()

    return VoiceTranscribeResponse(**result)


@router.post("/speak", response_model=VoiceSpeakResponse)
async def speak(payload: VoiceSpeakRequest, user_id: str | None = None, db: Session = Depends(get_db)):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    result = await voice_service.synthesize_speech(payload.text, voice=payload.voice)

    if user_id:
        db.add(VoiceLog(user_id=user_id, direction="tts", transcript=payload.text))
        db.commit()

    return VoiceSpeakResponse(audio_base64=result["audio_base64"], mime_type=result["mime_type"])
