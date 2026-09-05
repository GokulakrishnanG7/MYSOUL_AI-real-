"""
Rate limiting via slowapi (a FastAPI-friendly wrapper around limits).
Applied per-client-IP. Default budget is RATE_LIMIT_PER_MINUTE from .env.

Usage in main.py:
    from middleware.rate_limit import limiter, rate_limit_exceeded_handler
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

Usage on an individual route (only needed if you want a DIFFERENT budget
than the global default — most routes don't need this decorator at all
since SlowAPIMiddleware enforces the default automatically... but slowapi
requires explicit @limiter.limit(...) per-route for it to apply, so we
apply a shared default decorator via `default_limit` below):
    from middleware.rate_limit import limiter
    @limiter.limit("10/minute")
    @router.post("/chat")
    async def chat(...): ...
"""
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse

from config import get_settings

settings = get_settings()

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.rate_limit_per_minute}/minute"])


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down and try again shortly."},
    )
