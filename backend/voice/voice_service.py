"""
Voice System

Backs the frontend's mic button (#micBtn), AI speaking bar (#aiSpeakBar /
#interruptBtn), and voice corona visualizer. Two directions:

  STT (speech-to-text): faster-whisper, CPU-friendly reimplementation of
  OpenAI Whisper. Runs locally — no per-request cloud cost, works offline,
  fine for MVP latency (a few seconds for short clips on CPU).

  TTS (text-to-speech): edge-tts, using Microsoft Edge's free neural voices.
  Generates an mp3 file per request; the frontend can either fetch that file
  or (simplest) receive it as a data URL for immediate <audio> playback.

Voice interruption: the frontend already has an "interrupt" button
(#interruptBtn) — since our TTS is generate-then-play (not a live stream),
"interruption" is purely a client-side concern (pause/stop the <audio>
element). Nothing server-side needs to happen for it; documented here so
it's clear this isn't a missing backend feature.

Continuous listening / wake word ("Hey Soul"): the frontend explicitly
disabled this ("auto-voice-trigger removed: wake word feature not supported
reliably across browsers"), so no backend endpoint is built for it. If you
revisit this, the natural implementation is a streaming STT websocket
(faster-whisper supports partial/streaming decode) rather than a REST call.
"""
from __future__ import annotations

import base64
import io
import logging
import os
import tempfile
import threading
import uuid
from functools import lru_cache

import edge_tts
from faster_whisper import WhisperModel

from config import get_settings

logger = logging.getLogger("mysoul.voice")
settings = get_settings()


# ── STT: faster-whisper singleton ───────────────────────────────────────
class _WhisperEngine:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.model = WhisperModel(
            settings.whisper_model_size,
            device=settings.whisper_device,
            compute_type="int8" if settings.whisper_device == "cpu" else "float16",
        )

    @classmethod
    def get(cls) -> "_WhisperEngine":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def transcribe(self, audio_path: str) -> dict:
        segments, info = self.model.transcribe(audio_path, beam_size=5)
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return {
            "text": text,
            "language": info.language,
            "duration_seconds": getattr(info, "duration", None),
        }


@lru_cache
def get_whisper_engine() -> _WhisperEngine:
    return _WhisperEngine.get()


def transcribe_audio_bytes(audio_bytes: bytes, suffix: str = ".webm") -> dict:
    """
    Writes the uploaded audio (whatever the browser's MediaRecorder produced —
    typically webm/ogg) to a temp file and runs it through faster-whisper,
    which uses ffmpeg internally and handles most common containers.
    """
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        engine = get_whisper_engine()
        return engine.transcribe(tmp_path)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


# ── TTS: edge-tts ─────────────────────────────────────────────────────────
async def synthesize_speech(text: str, voice: str | None = None) -> dict:
    """
    Returns {"audio_base64": str, "mime_type": "audio/mpeg", "file_path": str}
    so the frontend can play it directly as a data URL:
        new Audio("data:audio/mpeg;base64," + audio_base64).play()
    A copy is also saved to disk (tts_output_dir) in case you'd rather serve
    it via a static file URL instead of inlining base64.
    """
    voice = voice or settings.edge_tts_voice
    os.makedirs(settings.tts_output_dir, exist_ok=True)
    file_path = os.path.join(settings.tts_output_dir, f"{uuid.uuid4().hex}.mp3")

    communicate = edge_tts.Communicate(text, voice)
    audio_chunks = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.write(chunk["data"])

    audio_bytes = audio_chunks.getvalue()
    with open(file_path, "wb") as f:
        f.write(audio_bytes)

    return {
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
        "mime_type": "audio/mpeg",
        "file_path": file_path,
    }
