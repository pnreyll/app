"""Single-admin session auth: httpOnly cookie -> sessions collection."""

from datetime import datetime, timezone

from fastapi import HTTPException, Request
from passlib.context import CryptContext

from lib.db import db

COOKIE_NAME = "cch_session"
SESSION_DAYS = 7
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except Exception:
        return False


async def require_admin(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Oturum bulunamadı")
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Oturum geçersiz")
    expires = session["expires_at"]
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user
