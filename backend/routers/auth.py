import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import COOKIE_NAME, SESSION_DAYS, require_admin, verify_password
from lib.db import db
from models.erp import AdminUser, LoginIn

router = APIRouter(prefix="/auth", tags=["auth"])


def _is_https(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https"


@router.post("/login", response_model=AdminUser)
async def login(body: LoginIn, request: Request, response: Response):
    user = await db.users.find_one({"email": body.email.strip().lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    token = secrets.token_urlsafe(32)
    await db.sessions.insert_one(
        {"token": token, "user_id": user["id"], "expires_at": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)}
    )
    response.set_cookie(
        COOKIE_NAME, token, httponly=True, samesite="lax", secure=_is_https(request),
        max_age=SESSION_DAYS * 86400, path="/",
    )
    return AdminUser(**user)


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.sessions.delete_one({"token": token})
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=AdminUser)
async def me(user: dict = Depends(require_admin)):
    return AdminUser(**user)
