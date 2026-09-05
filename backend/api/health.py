"""
Health API — backs the frontend's status beacon (#statusBeacon / #statusLabel,
which currently just says "Aware"). Reports whether OpenRouter and/or Ollama
are reachable so the frontend could show "Aware" vs "Degraded" vs "Offline".
"""
from fastapi import APIRouter

from services.llm_service import health_check

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    llm_status = await health_check()
    overall = "up" if "up" in llm_status.values() else "down"
    return {"status": overall, "llm_providers": llm_status}
