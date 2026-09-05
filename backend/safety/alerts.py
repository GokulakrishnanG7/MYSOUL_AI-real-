"""
Family Alert Service

Backs the frontend's SOS overlay button:
    document.getElementById('sosAlertFamily') -> SoulCore.sendFamilyAlert(reason)
    -> POST /alerts/family

Pluggable delivery providers, selected via ALERT_PROVIDER in .env:
    - "console" (default/dev): logs the alert, always "succeeds" — safe default
      so local development never silently pretends to text someone's family.
    - "smtp": sends a real email via SMTP_* settings.
    - "twilio": sends a real SMS via TWILIO_* settings.

Design notes:
- Never raises out to the caller — a failed alert must still let the frontend
  fall back to showing the iCall helpline number, which is static in the HTML.
- Every attempt (success or failure) is logged to the `family_alerts` table
  so a user/support can audit what was actually sent.
"""
from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from config import get_settings
from database.models import FamilyAlert, User

logger = logging.getLogger("mysoul.alerts")
settings = get_settings()


async def _send_console(user: User, reason: str) -> tuple[bool, str | None]:
    logger.warning(
        "[FAMILY ALERT - CONSOLE MODE] user=%s contact=%s/%s reason=%s",
        user.id, user.family_contact_email, user.family_contact_phone, reason,
    )
    return True, None


async def _send_smtp(user: User, reason: str) -> tuple[bool, str | None]:
    if not user.family_contact_email:
        return False, "No family contact email on file"
    if not (settings.smtp_host and settings.smtp_user and settings.smtp_password):
        return False, "SMTP is not configured"

    import smtplib
    from email.mime.text import MIMEText

    body = (
        f"This is an automated message from MySoul AI.\n\n"
        f"{user.name or 'Someone you care about'} may need support right now. "
        f"MySoul AI detected signs of distress during a recent conversation.\n\n"
        f"Reason: {reason}\n\n"
        f"Please consider checking in with them directly."
    )
    msg = MIMEText(body)
    msg["Subject"] = f"MySoul AI: {user.name or 'A loved one'} may need support"
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = user.family_contact_email

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(msg["From"], [user.family_contact_email], msg.as_string())
        return True, None
    except Exception as exc:
        logger.error("SMTP alert failed: %s", exc)
        return False, str(exc)


async def _send_twilio(user: User, reason: str) -> tuple[bool, str | None]:
    if not user.family_contact_phone:
        return False, "No family contact phone on file"
    if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number):
        return False, "Twilio is not configured"

    body = (
        f"MySoul AI: {user.name or 'Someone you care about'} may need support right now. "
        f"Please consider checking in with them."
    )
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                data={
                    "From": settings.twilio_from_number,
                    "To": user.family_contact_phone,
                    "Body": body,
                },
                auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            )
            resp.raise_for_status()
        return True, None
    except Exception as exc:
        logger.error("Twilio alert failed: %s", exc)
        return False, str(exc)


_PROVIDERS = {
    "console": _send_console,
    "smtp": _send_smtp,
    "twilio": _send_twilio,
}


async def send_family_alert(db: Session, user: User, reason: str) -> dict:
    """
    Sends the alert via the configured provider, logs it, and returns
    {"delivered": bool, "channel": str, "error": str | None}
    """
    provider_name = settings.alert_provider if settings.alert_provider in _PROVIDERS else "console"
    handler = _PROVIDERS[provider_name]

    delivered, error = await handler(user, reason)

    record = FamilyAlert(
        user_id=user.id,
        reason=reason,
        channel=provider_name,
        delivered=delivered,
        error=error,
    )
    db.add(record)
    db.commit()

    return {"delivered": delivered, "channel": provider_name, "error": error}
