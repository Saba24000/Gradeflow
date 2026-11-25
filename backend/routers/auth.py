from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

import auth, models
from database import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


def _issue_auth_response(
    response: Response, user: models.UserDB, db: Session, request: Request
) -> dict:
    access_token = auth.create_access_token(user)
    refresh_token = auth.create_refresh_session(db, user, request)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "is_banned": user.is_banned,
        },
    }


@router.post("/signup", status_code=201)
def signup(
    payload: SignupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    email_norm = payload.email.strip().lower()
    if db.query(models.UserDB).filter(models.UserDB.email == email_norm).first():
        raise HTTPException(status_code=400, detail="Email is already registered")

    is_first_user = db.query(models.UserDB).count() == 0
    role = "admin" if is_first_user else "user"

    user = models.UserDB(
        name=payload.name.strip(),
        email=email_norm,
        hashed_password=auth.hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    auth.log_audit(db, "signup", user=user, detail=f"Registered as {role}", request=request)
    return _issue_auth_response(response, user, db, request)


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    email_norm = payload.email.strip().lower()
    user = db.query(models.UserDB).filter(models.UserDB.email == email_norm).first()

    if not user or not auth.verify_password(payload.password, user.hashed_password):
        auth.log_audit(
            db,
            "login_failed",
            user=user,
            user_email=email_norm,
            detail="Invalid email or password",
            request=request,
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.is_banned:
        auth.log_audit(db, "login_blocked_banned", user=user, detail="Banned user login attempt", request=request)
        raise HTTPException(
            status_code=403,
            detail=f"Account suspended: {user.ban_reason or 'Contact admin'}",
        )

    auth.log_audit(db, "login_success", user=user, detail="User logged in", request=request)
    return _issue_auth_response(response, user, db, request)


@router.post("/refresh")
def refresh_tokens(
    request: Request,
    response: Response,
    payload: Optional[RefreshRequest] = None,
    db: Session = Depends(get_db),
):
    raw_token = (payload.refresh_token if payload else None) or request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    token_hash = auth.hash_token(raw_token)
    session = (
        db.query(models.RefreshSessionDB)
        .filter(models.RefreshSessionDB.token_hash == token_hash)
        .first()
    )

    if not session or session.revoked:
        if session and session.revoked:
            db.query(models.RefreshSessionDB).filter(
                models.RefreshSessionDB.user_id == session.user_id
            ).update({"revoked": True})
            db.commit()
            auth.log_audit(
                db,
                "token_reuse_detected",
                user_email=str(session.user_id),
                detail="Revoked refresh token reused; all sessions invalidated",
                request=request,
            )
        raise HTTPException(status_code=401, detail="Invalid or revoked refresh token")

    exp = session.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        session.revoked = True
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user = db.query(models.UserDB).filter(models.UserDB.id == session.user_id).first()
    if not user or user.is_banned:
        raise HTTPException(status_code=403, detail="User inactive or banned")

    session.revoked = True
    db.commit()

    auth.log_audit(db, "token_refreshed", user=user, detail="Rotated refresh token", request=request)
    return _issue_auth_response(response, user, db, request)


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    payload: Optional[RefreshRequest] = None,
    db: Session = Depends(get_db),
):
    raw_token = (payload.refresh_token if payload else None) or request.cookies.get("refresh_token")
    if raw_token:
        token_hash = auth.hash_token(raw_token)
        session = (
            db.query(models.RefreshSessionDB)
            .filter(models.RefreshSessionDB.token_hash == token_hash)
            .first()
        )
        if session:
            session.revoked = True
            db.commit()
            user = db.query(models.UserDB).filter(models.UserDB.id == session.user_id).first()
            auth.log_audit(db, "logout", user=user, detail="User logged out", request=request)

    response.delete_cookie("refresh_token")
    return {"detail": "Logged out successfully"}


@router.get("/me")
def get_me(current_user: models.UserDB = Depends(auth.get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "is_banned": current_user.is_banned,
        "created_at": current_user.created_at,
    }


@router.patch("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    current_user: models.UserDB = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    current_user.name = payload.name.strip()
    db.commit()
    db.refresh(current_user)
    auth.log_audit(db, "profile_updated", user=current_user, detail="Updated display name", request=request)
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "is_banned": current_user.is_banned,
    }


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: models.UserDB = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not auth.verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = auth.hash_password(payload.new_password)
    db.commit()
    auth.log_audit(db, "password_changed", user=current_user, detail="Changed account password", request=request)
    return {"detail": "Password updated successfully"}


@router.get("/sessions")
def list_sessions(
    current_user: models.UserDB = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(models.RefreshSessionDB)
        .filter(
            models.RefreshSessionDB.user_id == current_user.id,
            models.RefreshSessionDB.revoked == False,
        )
        .order_by(models.RefreshSessionDB.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "user_agent": s.user_agent,
            "ip_address": s.ip_address,
            "created_at": s.created_at,
            "expires_at": s.expires_at,
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: int,
    request: Request,
    current_user: models.UserDB = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(models.RefreshSessionDB)
        .filter(
            models.RefreshSessionDB.id == session_id,
            models.RefreshSessionDB.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.revoked = True
    db.commit()
    auth.log_audit(db, "session_revoked", user=current_user, detail=f"Revoked session #{session_id}", request=request)
    return {"detail": "Session revoked"}