from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
import models
from database import get_db


class Perm:
    ADMIN_ACCESS = "admin:access"
    GROUP_CREATE = "create"
    GROUP_UPDATE = "update"
    GROUP_ASSIGN = "assign"


def require_role(*allowed_roles: str):
    from auth import get_current_user

    def _checker(current_user: models.UserDB = Depends(get_current_user)) -> models.UserDB:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(allowed_roles)}"
            )
        return current_user

    return _checker


def check_assignment_access(
    assignment: models.AssignmentDB,
    user: models.UserDB,
    db: Session,
    required_perm: str | None = None
) -> None:
    if user.role == "admin" or assignment.owner_id == user.id:
        return

    if assignment.group_id:
        group = db.query(models.GroupDB).filter(models.GroupDB.id == assignment.group_id).first()
        if group and group.owner_id == user.id:
            return
        member = (
            db.query(models.GroupMemberDB)
            .filter(
                models.GroupMemberDB.group_id == assignment.group_id,
                models.GroupMemberDB.user_id == user.id
            )
            .first()
        )
        if member:
            if required_perm is None:
                return
            perms = {p.strip() for p in member.permissions.split(",") if p.strip()}
            if required_perm in perms:
                return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to perform this action on this record"
    )


def check_group_permission(
    group: models.GroupDB,
    user: models.UserDB,
    db: Session,
    required_perm: str | None = None,
    owner_only: bool = False
) -> None:
    if user.role == "admin" or group.owner_id == user.id:
        return
    if owner_only:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can manage, rename, or delete this group"
        )
    member = (
        db.query(models.GroupMemberDB)
        .filter(models.GroupMemberDB.group_id == group.id, models.GroupMemberDB.user_id == user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this group")
    if required_perm:
        perms = {p.strip() for p in member.permissions.split(",") if p.strip()}
        if required_perm not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing group permission: {required_perm}"
            )