"""
LLM Service — OpenRouter (primary) with automatic Ollama (fallback) failover.

    User Message
        │
        ▼
    OpenRouter  ──success──►  Return
        │
      failure (timeout / 4xx / 5xx / circuit open)
        │
        ▼
    Ollama (local) ──success──► Return
        │
      failure
        ▼
    Graceful, in-character error message (never a raw stack trace to the user)

Where your OpenRouter key lives: config.py reads it from the OPENROUTER_API_KEY
environment variable (set it in your `.env` — see .env.example). It is never
hardcoded and never logged.
"""
from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field

import httpx
from tenacity import (
    retry, stop_after_attempt, wait_exponential, retry_if_exception_type,
)

from config import get_settings

logger = logging.getLogger("mysoul.llm")
settings = get_settings()


class LLMUnavailableError(Exception):
    """Raised when both OpenRouter and Ollama fail."""


# ── Circuit Breaker ──────────────────────────────────────────────────────
@dataclass
class CircuitBreaker:
    """
    Simple in-memory circuit breaker per provider. After N consecutive
    failures, the circuit "opens" and calls are skipped (fail fast, go
    straight to fallback) until `reset_seconds` has passed, then it goes
    "half-open" and allows one trial call.
    """
    failure_threshold: int
    reset_seconds: int
    _failures: int = field(default=0, init=False)
    _opened_at: float | None = field(default=None, init=False)

    def is_open(self) -> bool:
        if self._opened_at is None:
            return False
        if time.time() - self._opened_at >= self.reset_seconds:
            # half-open: allow a trial call through
            return False
        return True

    def record_success(self):
        self._failures = 0
        self._opened_at = None

    def record_failure(self):
        self._failures += 1
        if self._failures >= self.failure_threshold:
            self._opened_at = time.time()
            logger.warning("Circuit breaker OPEN after %s consecutive failures", self._failures)


openrouter_breaker = CircuitBreaker(
    failure_threshold=settings.circuit_breaker_failure_threshold,
    reset_seconds=settings.circuit_breaker_reset_seconds,
)
ollama_breaker = CircuitBreaker(
    failure_threshold=settings.circuit_breaker_failure_threshold,
    reset_seconds=settings.circuit_breaker_reset_seconds,
)


# ── Provider calls ───────────────────────────────────────────────────────
@retry(
    reraise=True,
    stop=stop_after_attempt(settings.openrouter_max_retries + 1),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError, httpx.ConnectError)),
)
async def _call_openrouter(system_prompt: str, user_message: str, history: list[dict]) -> str:
    if not settings.openrouter_api_key:
        raise LLMUnavailableError("OPENROUTER_API_KEY is not set")

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }
    # Optional but OpenRouter recommends these for attribution/leaderboards
    if settings.openrouter_site_url:
        headers["HTTP-Referer"] = settings.openrouter_site_url
    if settings.openrouter_app_name:
        headers["X-Title"] = settings.openrouter_app_name

    messages = [{"role": "system", "content": system_prompt}, *history,
                {"role": "user", "content": user_message}]

    payload = {"model": settings.openrouter_model, "messages": messages, "temperature": 0.8}

    async with httpx.AsyncClient(timeout=settings.openrouter_timeout_seconds) as client:
        resp = await client.post(
            f"{settings.openrouter_base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


@retry(
    reraise=True,
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=3),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
)
async def _call_ollama(system_prompt: str, user_message: str, history: list[dict]) -> str:
    messages = [{"role": "system", "content": system_prompt}, *history,
                {"role": "user", "content": user_message}]
    payload = {"model": settings.ollama_model, "messages": messages, "stream": False}

    async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
        resp = await client.post(f"{settings.ollama_base_url}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"].strip()


# ── Public entry point ───────────────────────────────────────────────────
async def generate_reply(system_prompt: str, user_message: str, history: list[dict] | None = None) -> dict:
    """
    Returns: {"reply": str, "provider_used": "openrouter" | "ollama", "degraded": bool}
    Never raises to the caller under normal failure conditions — always
    returns *something* conversational, per the "no crash, no waiting
    forever" requirement.
    """
    history = history or []

    if not openrouter_breaker.is_open():
        try:
            reply = await _call_openrouter(system_prompt, user_message, history)
            openrouter_breaker.record_success()
            return {"reply": reply, "provider_used": "openrouter", "degraded": False}
        except Exception as exc:
            logger.error("OpenRouter failed, falling back to Ollama: %s", exc)
            openrouter_breaker.record_failure()
    else:
        logger.info("OpenRouter circuit open — skipping straight to Ollama")

    if not ollama_breaker.is_open():
        try:
            reply = await _call_ollama(system_prompt, user_message, history)
            ollama_breaker.record_success()
            return {"reply": reply, "provider_used": "ollama", "degraded": True}
        except Exception as exc:
            logger.error("Ollama fallback also failed: %s", exc)
            ollama_breaker.record_failure()
    else:
        logger.info("Ollama circuit open too — both providers unavailable")

    # Both providers down: return a safe, in-character message instead of crashing.
    return {
        "reply": ("I'm having trouble reaching my thinking right now, but I'm still here "
                  "with you. Can we try again in a moment?"),
        "provider_used": "none",
        "degraded": True,
    }


async def health_check() -> dict:
    """Used by GET /health for uptime monitoring / the frontend's status beacon."""
    result = {"openrouter": "unknown", "ollama": "unknown"}
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            r = await client.get(f"{settings.openrouter_base_url}/models",
                                  headers={"Authorization": f"Bearer {settings.openrouter_api_key}"})
            result["openrouter"] = "up" if r.status_code < 500 else "down"
        except Exception:
            result["openrouter"] = "down"
        try:
            r = await client.get(f"{settings.ollama_base_url}/api/tags")
            result["ollama"] = "up" if r.status_code < 500 else "down"
        except Exception:
            result["ollama"] = "down"
    return result
