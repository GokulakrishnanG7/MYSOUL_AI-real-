"""Compatibility authentication and onboarding endpoints for the existing frontend."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from config import get_settings
from database.db import get_db
from database.models import User

router = APIRouter(prefix="/api/auth", tags=["frontend-auth"])
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SetupRequest(BaseModel):
    user_id: str | None = None
    ai_name: str = Field(default="MySoul", min_length=1, max_length=40)
    user_name: str = Field(default="Friend", min_length=1, max_length=40)
    language: str = Field(default="en", min_length=2, max_length=10)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    user_id: str | None = None
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    ai_name: str | None = Field(default=None, max_length=40)
    user_name: str | None = Field(default=None, max_length=80)
    language: str = Field(default="en", min_length=2, max_length=10)


def _create_token(user: User) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user.id, "email": user.email, "exp": expires}
    return jwt.encode(payload, settings.app_secret_key, algorithm=settings.jwt_algorithm)


def _ensure_user(
    db: Session,
    *,
    user_id: str | None,
    name: str | None,
    ai_name: str | None,
    language: str,
    email: str | None = None,
    password: str | None = None,
) -> User:
    user = db.query(User).filter(User.id == user_id).first() if user_id else None
    if user is None and email:
        user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            id=user_id or None,
            name=name,
            ai_nickname=ai_name,
            language=language,
            email=email,
            hashed_passcode=pwd_context.hash(password) if password else None,
        )
        db.add(user)
    else:
        if name:
            user.name = name
        if ai_name:
            user.ai_nickname = ai_name
        if language:
            user.language = language
        if email and not user.email:
            user.email = email
        if password:
            user.hashed_passcode = pwd_context.hash(password)
    db.commit()
    db.refresh(user)
    return user


@router.post("/setup")
def save_setup(payload: SetupRequest, db: Session = Depends(get_db)):
    """Persist onboarding data against the same local user id used by chat."""
    user = _ensure_user(
        db,
        user_id=payload.user_id,
        name=payload.user_name,
        ai_name=payload.ai_name,
        language=payload.language,
    )
    return {"ok": True, "user_id": user.id, "user_name": user.name, "ai_name": user.ai_nickname, "language": user.language}


@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == str(payload.email)).first()
    if existing and existing.hashed_passcode:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = _ensure_user(
        db,
        user_id=payload.user_id,
        name=payload.name,
        ai_name=payload.ai_name,
        language=payload.language,
        email=str(payload.email),
        password=payload.password,
    )
    return {"access_token": _create_token(user), "token_type": "bearer", "user_id": user.id}


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(payload.email)).first()
    if not user or not user.hashed_passcode or not pwd_context.verify(payload.password, user.hashed_passcode):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": _create_token(user), "token_type": "bearer", "user_id": user.id}


@router.get("/google")
def google_oauth(redirect_uri: str | None = Query(default=None)):
    """Return a clear response instead of the previous frontend 404.

    OAuth credentials are intentionally not guessed or hardcoded. The UI can
    keep the button, while deployments with a real provider can replace this
    adapter without changing the rest of the frontend.
    """
    return JSONResponse(
        status_code=501,
        content={"detail": "Google sign-in is not configured for this deployment", "redirect_uri": redirect_uri},
    )


@router.get("/google/callback")
def google_callback():
    return JSONResponse(status_code=501, content={"detail": "Google sign-in is not configured for this deployment"})


__all__ = ["router"]
