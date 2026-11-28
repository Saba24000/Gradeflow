from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from auth import (
    create_access_token,
    create_refresh_session,
    get_current_user,
    hash_password,
    log_audit,
    verify_password,
)
from database import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6)
    institute: Optional[str] = ""


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1)


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    institute: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


def serialize_user(user: models.UserDB) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "institute": getattr(user, "institute", "") or "",
        "department": getattr(user, "department", "") or "",
        "bio": getattr(user, "bio", "") or "",
        "avatar_url": getattr(user, "avatar_url", "") or "",
    }


@router.post("/signup")
def signup(payload: SignupRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    clean_email = payload.email.strip().lower()
    clean_name = payload.name.strip()

    if "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Please enter your name")

    existing = db.query(models.UserDB).filter(models.UserDB.email == clean_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")

    user = models.UserDB(
        name=clean_name,
        email=clean_email,
        hashed_password=hash_password(payload.password),
        role="user",
        is_banned=False,
        institute=(payload.institute or "").strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user)
    refresh_token = create_refresh_session(db, user, request)
    log_audit(db, "SIGNUP", user=user, detail="Account created", request=request)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    clean_email = payload.email.strip().lower()
    user = db.query(models.UserDB).filter(models.UserDB.email == clean_email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        log_audit(db, "LOGIN_FAILED", user_email=clean_email, detail="Invalid credentials", request=request)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.is_banned:
        raise HTTPException(status_code=403, detail=f"Account suspended: {user.ban_reason or 'Policy violation'}")

    access_token = create_access_token(user)
    refresh_token = create_refresh_session(db, user, request)
    log_audit(db, "LOGIN_SUCCESS", user=user, detail="User logged in", request=request)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@router.get("/me")
def get_me(current_user: models.UserDB = Depends(get_current_user)):
    return serialize_user(current_user)


@router.patch("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    if payload.name is not None and payload.name.strip():
        current_user.name = payload.name.strip()
    if payload.institute is not None:
        current_user.institute = payload.institute.strip()
    if payload.department is not None:
        current_user.department = payload.department.strip()
    if payload.bio is not None:
        current_user.bio = payload.bio.strip()
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url

    db.commit()
    db.refresh(current_user)
    log_audit(db, "PROFILE_UPDATED", user=current_user, detail="Updated profile details")
    return serialize_user(current_user)


@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    log_audit(db, "PASSWORD_CHANGED", user=current_user, detail="Password updated")
    return {"status": "ok"}


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    sessions = (
        db.query(models.RefreshSessionDB)
        .filter(
            models.RefreshSessionDB.user_id == current_user.id,
            models.RefreshSessionDB.revoked == False,
        )
        .order_by(models.RefreshSessionDB.id.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "ip_address": s.ip_address,
            "user_agent": s.user_agent,
            "created_at": s.created_at.isoformat() if s.created_at else "",
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
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
    return {"status": "revoked"}


@router.post("/logout")
def logout():
    return {"status": "logged_out"}