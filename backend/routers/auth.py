from datetime import datetime, timezone
from typing import Optional 
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_session,
    log_audit,
)

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import auth, models
from database import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
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
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
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
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


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
@router.post("/guest")
def guest_login(request: Request, db: Session = Depends(get_db)):
    guest_email = "demo@gradeflow.app"
    guest_user = db.query(models.UserDB).filter(models.UserDB.email == guest_email).first()

    if not guest_user:
        guest_user = models.UserDB(
            name="Guest Student",
            email=guest_email,
            hashed_password=hash_password("GuestDemo@2026"),
            role="user",
            is_banned=False,
        )
        db.add(guest_user)
        db.commit()
        db.refresh(guest_user)

    # Seed starter study groups for Guest Demo
    existing_groups = (
        db.query(models.GroupDB)
        .filter(models.GroupDB.owner_id == guest_user.id)
        .all()
    )
    if len(existing_groups) == 0:
        demo_groups = [
            models.GroupDB(
                name="CSE309 Web Security Team",
                description="Final project & RBAC demo group",
                owner_id=guest_user.id,
            ),
            models.GroupDB(
                name="CSE370 Database Study Group",
                description="SQL & ER modeling collaboration",
                owner_id=guest_user.id,
            ),
            models.GroupDB(
                name="CSE422 AI Lab Partners",
                description="Search algorithms & ML lab group",
                owner_id=guest_user.id,
            ),
        ]
        db.add_all(demo_groups)
        db.commit()
        for g in demo_groups:
            db.refresh(g)
            db.add(
                models.GroupMemberDB(
                    group_id=g.id,
                    user_id=guest_user.id,
                    permissions="create,update,assign",
                )
            )
        db.commit()

    # Seed starter course assignments for Guest Demo
    existing_count = (
        db.query(models.AssignmentDB)
        .filter(models.AssignmentDB.owner_id == guest_user.id)
        .count()
    )
    if existing_count == 0:
        starter_assignments = [
            models.AssignmentDB(
                title="RBAC & JWT Security Audit Report",
                course_code="CSE309",
                description="Document authentication flow, token rotation, and role-based access rules.",
                due_date="2026-12-05",
                status="pending",
                owner_id=guest_user.id,
            ),
            models.AssignmentDB(
                title="ER Diagram & Relational Schema Normalization",
                course_code="CSE370",
                description="Normalize university database schema up to 3NF and verify foreign keys.",
                due_date="2026-12-09",
                status="pending",
                owner_id=guest_user.id,
            ),
            models.AssignmentDB(
                title="A* Search & Heuristic Pathfinding Lab",
                course_code="CSE422",
                description="Compare Manhattan vs Euclidean heuristics on grid mazes.",
                due_date="2026-12-14",
                status="pending",
                owner_id=guest_user.id,
            ),
        ]
        db.add_all(starter_assignments)
        db.commit()

    access_token = create_access_token(guest_user)
    refresh_token = create_refresh_session(db, guest_user, request)
    log_audit(db, "GUEST_LOGIN", user=guest_user, detail="Demo guest session started", request=request)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": guest_user.id,
            "name": guest_user.name,
            "email": guest_user.email,
            "role": guest_user.role,
        },
    }