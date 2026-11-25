from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

import auth
import models
from database import get_db

router = APIRouter(prefix="/groups", tags=["groups"])


class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class MemberAdd(BaseModel):
    email: str
    permissions: str = "create"


@router.get("")
def list_groups(
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(auth.get_current_user),
):
    if current_user.role == "admin":
        groups = db.query(models.GroupDB).all()
    else:
        member_group_ids = [
            m.group_id
            for m in db.query(models.GroupMemberDB)
            .filter(models.GroupMemberDB.user_id == current_user.id)
            .all()
        ]
        groups = (
            db.query(models.GroupDB)
            .filter(
                (models.GroupDB.owner_id == current_user.id)
                | (models.GroupDB.id.in_(member_group_ids))
            )
            .all()
        )

    result = []
    for g in groups:
        owner = db.query(models.UserDB).filter(models.UserDB.id == g.owner_id).first()
        members = db.query(models.GroupMemberDB).filter(models.GroupMemberDB.group_id == g.id).all()
        result.append(
            {
                "id": g.id,
                "name": g.name,
                "description": g.description or "",
                "owner_id": g.owner_id,
                "owner_email": owner.email if owner else "",
                "member_count": len(members),
            }
        )
    return result


@router.post("")
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(auth.get_current_user),
):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Group name is required")

    group = models.GroupDB(
        name=payload.name.strip(),
        description=(payload.description or "").strip(),
        owner_id=current_user.id,
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "owner_id": group.owner_id,
        "owner_email": current_user.email,
        "member_count": 0,
    }


@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(auth.get_current_user),
):
    group = db.query(models.GroupDB).filter(models.GroupDB.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this group")

    db.delete(group)
    db.commit()
    return {"detail": "Group deleted"}