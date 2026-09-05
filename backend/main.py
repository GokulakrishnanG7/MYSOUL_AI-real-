"""
MySoul AI Backend — main entrypoint.

Run with:
    uvicorn main:app --reload --port 8000

On startup:
    - Creates all DB tables if they don't exist (init_db).
    - Starts the Proactive Companion Engine's background scheduler.
On shutdown:
    - Stops the scheduler cleanly.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import get_settings
from database.db import init_db
from middleware.logging_middleware import AuditLoggingMiddleware
from middleware.rate_limit import limiter, rate_limit_exceeded_handler
from scheduler.followup_scheduler import start_scheduler, stop_scheduler

from api import (
    alerts,
    analytics,
    chat,
    compat,
    dashboard,
    emotion,
    event,
    followup,
    goals,
    health,
    journal,
    memory,
    settings as settings_router,
    tasks,
    users,
    voice,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("mysoul.main")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MySoul AI backend (env=%s)", settings.app_env)
    init_db()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("MySoul AI backend shut down cleanly")


app = FastAPI(
    title="MySoul AI Backend",
    description="Emotionally intelligent life companion — API for chat, emotion, memory, voice, and proactive follow-ups.",
    version="2.0.0",
    lifespan=lifespan,
)

# ── Rate limiting ─────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── Audit logging ─────────────────────────────────────────────────────────
app.add_middleware(AuditLoggingMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(compat.router)  # /api/* — matches your existing frontend JS exactly
app.include_router(health.router)
app.include_router(users.router)
app.include_router(chat.router)
app.include_router(emotion.router)
app.include_router(memory.router)
app.include_router(event.router)
app.include_router(followup.router)
app.include_router(voice.router)
app.include_router(dashboard.router)
app.include_router(tasks.router)
app.include_router(goals.router)
app.include_router(journal.router)
app.include_router(analytics.router)
app.include_router(settings_router.router)
app.include_router(alerts.router)


@app.get("/")
def root():
    return {"service": "MySoul AI Backend", "status": "awake", "version": "2.0.0"}
