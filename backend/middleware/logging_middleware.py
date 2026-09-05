"""
Audit logging middleware.

Logs method, path, status code, and duration for every request. Never logs
request/response bodies (chat content, emotion text, etc. are sensitive) or
secrets/headers like Authorization. This satisfies the "audit logging"
requirement from the spec without creating a second place PII could leak
from.
"""
import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("mysoul.audit")


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = None
        try:
            response = await call_next(request)
            return response
        finally:
            duration_ms = round((time.time() - start) * 1000, 1)
            status = response.status_code if response else 500
            logger.info(
                "%s %s -> %s (%sms) ip=%s",
                request.method,
                request.url.path,
                status,
                duration_ms,
                request.client.host if request.client else "unknown",
            )
