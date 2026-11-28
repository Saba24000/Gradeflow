from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from auth import get_current_user, log_audit
from database import get_db

router = APIRouter(prefix="/groups", tags=["Groups"])


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""


class AddMemberRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    role: str = "editor"


@router.get("")
@router.get("/")
def list_groups(
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    if not hasattr(models, "StudyGroupDB"):
        return []

    groups = db.query(models.StudyGroupDB).order_by(models.StudyGroupDB.id.desc()).all()
    result = []

    for g in groups:
        members_data = []
        if hasattr(models, "GroupMemberDB"):
            members = (
                db.query(models.GroupMemberDB)
                .filter(models.GroupMemberDB.group_id == g.id)
                .all()
            )
            for m in members:
                u = db.query(models.UserDB).filter(models.UserDB.id == m.user_id).first()
                members_data.append(
                    {
                        "id": m.id,
                        "user_id": m.user_id,
                        "email": u.email if u else "",
                        "name": u.name if u else "",
                        "role": getattr(m, "role", "viewer"),
                    }
                )

        is_owner = getattr(g, "owner_id", None) == current_user.id
        is_member = any(m["user_id"] == current_user.id for m in members_data)

        if current_user.role == "admin" or is_owner or is_member:
            my_role = (
                "owner"
                if is_owner
                else next(
                    (m["role"] for m in members_data if m["user_id"] == current_user.id),
                    "admin",
                )
            )
            result.append(
                {
                    "id": g.id,
                    "name": g.name,
                    "description": getattr(g, "description", "") or "",
                    "owner_id": getattr(g, "owner_id", None),
                    "my_role": my_role,
                    "members": members_data,
                }
            )

    return result


@router.post("")
@router.post("/")
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    if not hasattr(models, "StudyGroupDB"):
        raise HTTPException(status_code=501, detail="StudyGroupDB model not found")

    group = models.StudyGroupDB(
        name=payload.name.strip(),
        description=(payload.description or "").strip(),
        owner_id=current_user.id,
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    log_audit(db, "GROUP_CREATED", user=current_user, detail=f"Created group '{group.name}'")
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description or "",
        "owner_id": group.owner_id,
        "my_role": "owner",
        "members": [],
    }


@router.post("/{group_id}/members")
def add_group_member(
    group_id: int,
    payload: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    if not hasattr(models, "StudyGroupDB") or not hasattr(models, "GroupMemberDB"):
        raise HTTPException(status_code=501, detail="Group membership models not configured")

    group = db.query(models.StudyGroupDB).filter(models.StudyGroupDB.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Study group not found")

    if group.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the group owner or an admin can add members")

    clean_email = payload.email.strip().lower()
    target_user = db.query(models.UserDB).filter(models.UserDB.email == clean_email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"No user found with email {clean_email}")

    role = payload.role if payload.role in ("viewer", "editor", "admin") else "editor"

    existing = (
        db.query(models.GroupMemberDB)
        .filter(
            models.GroupMemberDB.group_id == group_id,
            models.GroupMemberDB.user_id == target_user.id,
        )
        .first()
    )
    if existing:
        existing.role = role
    else:
        db.add(
            models.GroupMemberDB(
                group_id=group_id,
                user_id=target_user.id,
                role=role,
            )
        )

    db.commit()
    log_audit(
        db,
        "GROUP_MEMBER_ADDED",
        user=current_user,
        detail=f"Added {clean_email} ({role}) to '{group.name}'",
    )
    return {"status": "ok", "email": clean_email, "role": role}


@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    if not hasattr(models, "StudyGroupDB"):
        raise HTTPException(status_code=501, detail="StudyGroupDB model not found")

    group = db.query(models.StudyGroupDB).filter(models.StudyGroupDB.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Study group not found")

    if group.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the group owner or an admin can delete this group")

    if hasattr(models, "GroupMemberDB"):
        db.query(models.GroupMemberDB).filter(models.GroupMemberDB.group_id == group_id).delete()

    db.delete(group)
    db.commit()
    log_audit(db, "GROUP_DELETED", user=current_user, detail=f"Deleted group '{group.name}'")
    return {"status": "deleted"}