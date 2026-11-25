from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

import auth, models, rbac
from database import get_db

router = APIRouter(prefix="/groups", tags=["Groups"])


class GroupCreate(BaseModel):
    name: str
    description: str = ""


class GroupUpdate(BaseModel):
    name: str
    description: str = ""


class MemberAdd(BaseModel):
    email: EmailStr
    permissions: list[str] = ["create"]  # subset of ["create", "update", "assign"]


@router.get("")
def list_my_groups(current_user: models.UserDB = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        groups = db.query(models.GroupDB).all()
    else:
        owned = db.query(models.GroupDB).filter(models.GroupDB.owner_id == current_user.id).all()
        member_ids = [
            m.group_id
            for m in db.query(models.GroupMemberDB).filter(models.GroupMemberDB.user_id == current_user.id).all()
        ]
        shared = db.query(models.GroupDB).filter(models.GroupDB.id.in_(member_ids)).all() if member_ids else []
        seen = {}
        for g in owned + shared:
            seen[g.id] = g
        groups = list(seen.values())

    result = []
    for g in groups:
        members = [
            {
                "user_id": m.user_id,
                "email": m.user.email if m.user else "",
                "permissions": [p for p in m.permissions.split(",") if p],
            }
            for m in g.members
        ]
        result.append(
            {
                "id": g.id,
                "name": g.name,
                "description": g.description,
                "owner_id": g.owner_id,
                "members": members,
            }
        )
    return result


@router.post("", status_code=201)
def create_group(
    payload: GroupCreate,
    current_user: models.UserDB = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    group = models.GroupDB(name=payload.name.strip(), description=payload.description, owner_id=current_user.id)
    db.add(group)
    db.commit()
    db.refresh(group)
    return {"id": group.id, "name": group.name, "description": group.description, "owner_id": group.owner_id, "members": []}


@router.put("/{group_id}")
def rename_group(
    group_id: int,
    payload: GroupUpdate,
    current_user: models.UserDB = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.GroupDB).filter(models.GroupDB.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    rbac.check_group_permission(group, current_user, db, owner_only=True)
    group.name = payload.name.strip()
    group.description = payload.description
    db.commit()
    return {"detail": "Group updated"}


@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    current_user: models.UserDB = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.GroupDB).filter(models.GroupDB.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    rbac.check_group_permission(group, current_user, db, owner_only=True)
    db.delete(group)
    db.commit()
    return {"detail": "Group deleted"}


@router.post("/{group_id}/members")
def add_or_update_member(
    group_id: int,
    payload: MemberAdd,
    current_user: models.UserDB = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.GroupDB).filter(models.GroupDB.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    rbac.check_group_permission(group, current_user, db, owner_only=True)

    target = db.query(models.UserDB).filter(models.UserDB.email == payload.email.lower()).first()
    if not target:
        raise HTTPException(status_code=404, detail="User with that email not found")

    allowed = {"create", "update", "assign"}
    clean_perms = ",".join([p for p in payload.permissions if p in allowed]) or "create"

    member = (
        db.query(models.GroupMemberDB)
        .filter(models.GroupMemberDB.group_id == group.id, models.GroupMemberDB.user_id == target.id)
        .first()
    )
    if member:
        member.permissions = clean_perms
    else:
        member = models.GroupMemberDB(group_id=group.id, user_id=target.id, permissions=clean_perms)
        db.add(member)
    db.commit()
    return {"detail": "Member permissions saved", "user_id": target.id, "permissions": clean_perms.split(",")}


@router.delete("/{group_id}/members/{user_id}")
def remove_member(
    group_id: int,
    user_id: int,
    current_user: models.UserDB = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.GroupDB).filter(models.GroupDB.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    rbac.check_group_permission(group, current_user, db, owner_only=True)

    member = (
        db.query(models.GroupMemberDB)
        .filter(models.GroupMemberDB.group_id == group.id, models.GroupMemberDB.user_id == user_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return {"detail": "Member removed"}