import csv
import io
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import get_current_user, log_audit
from database import get_db

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(current_user: models.UserDB = Depends(get_current_user)) -> models.UserDB:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user


class RoleUpdateRequest(BaseModel):
    role: str


class BanUpdateRequest(BaseModel):
    is_banned: bool
    ban_reason: Optional[str] = None


class BulkBanRequest(BaseModel):
    user_ids: List[int]
    is_banned: bool


@router.get("/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    admin: models.UserDB = Depends(require_admin),
):
    total_users = db.query(models.UserDB).count()
    banned_users = db.query(models.UserDB).filter(models.UserDB.is_banned == True).count()
    active_users = total_users - banned_users
    total_records = db.query(models.AssignmentDB).count()

    active_sessions = 0
    if hasattr(models, "RefreshSessionDB"):
        active_sessions = db.query(models.RefreshSessionDB).count()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "banned_users": banned_users,
        "total_records": total_records,
        "active_sessions": active_sessions,
    }


@router.get("/users")
def list_admin_users(
    search: str = "",
    db: Session = Depends(get_db),
    admin: models.UserDB = Depends(require_admin),
):
    query = db.query(models.UserDB)
    if search.strip():
        pattern = f"%{search.strip().lower()}%"
        query = query.filter(models.UserDB.email.ilike(pattern))

    users = query.order_by(models.UserDB.id.asc()).all()
    return {
        "items": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "is_banned": bool(u.is_banned),
            }
            for u in users
        ]
    }


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    admin: models.UserDB = Depends(require_admin),
):
    if payload.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin role")

    target = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.role = payload.role
    db.commit()
    log_audit(db, "ROLE_CHANGED", user=admin, detail=f"{target.email} -> {payload.role}")
    return {"id": target.id, "role": target.role}


@router.patch("/users/{user_id}/ban")
def toggle_user_ban(
    user_id: int,
    payload: BanUpdateRequest,
    db: Session = Depends(get_db),
    admin: models.UserDB = Depends(require_admin),
):
    target = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot ban an admin account")

    target.is_banned = payload.is_banned
    if hasattr(target, "ban_reason"):
        target.ban_reason = payload.ban_reason or ("Suspended by admin" if payload.is_banned else None)
    db.commit()
    log_audit(db, "USER_BAN_UPDATED", user=admin, detail=f"{target.email} banned={payload.is_banned}")
    return {"id": target.id, "is_banned": target.is_banned}


@router.post("/users/bulk-ban")
def bulk_ban_users(
    payload: BulkBanRequest,
    db: Session = Depends(get_db),
    admin: models.UserDB = Depends(require_admin),
):
    targets = (
        db.query(models.UserDB)
        .filter(models.UserDB.id.in_(payload.user_ids), models.UserDB.role != "admin")
        .all()
    )
    for t in targets:
        t.is_banned = payload.is_banned
    db.commit()
    log_audit(db, "BULK_BAN", user=admin, detail=f"{len(targets)} users banned={payload.is_banned}")
    return {"updated": len(targets)}


@router.get("/audit-logs")
def get_audit_logs(
    db: Session = Depends(get_db),
    admin: models.UserDB = Depends(require_admin),
):
    if not hasattr(models, "AuditLogDB"):
        return []
    logs = db.query(models.AuditLogDB).order_by(models.AuditLogDB.id.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "event_type": getattr(l, "event_type", "EVENT"),
            "user_email": getattr(l, "user_email", "System"),
            "detail": getattr(l, "detail", ""),
        }
        for l in logs
    ]


@router.get("/security")
def get_security_overview(
    db: Session = Depends(get_db),
    admin: models.UserDB = Depends(require_admin),
):
    failed_logins = 0
    if hasattr(models, "AuditLogDB"):
        failed_logins = (
            db.query(models.AuditLogDB)
            .filter(models.AuditLogDB.event_type == "LOGIN_FAILED")
            .count()
        )
    return {"failed_logins": failed_logins, "status": "healthy"}


@router.get("/export/{resource}")
def export_admin_csv(
    resource: str,
    db: Session = Depends(get_db),
    admin: models.UserDB = Depends(require_admin),
):
    output = io.StringIO()
    writer = csv.writer(output)

    if resource == "users":
        writer.writerow(["ID", "Name", "Email", "Role", "Is Banned"])
        for u in db.query(models.UserDB).order_by(models.UserDB.id.asc()).all():
            writer.writerow([u.id, u.name, u.email, u.role, u.is_banned])
    elif resource == "records":
        writer.writerow(["ID", "Title", "Course Code", "Due Date", "Owner ID", "Group ID"])
        for a in db.query(models.AssignmentDB).order_by(models.AssignmentDB.id.asc()).all():
            writer.writerow([a.id, a.title, a.course_code, a.due_date, a.owner_id, a.group_id])
    elif resource == "activity":
        writer.writerow(["ID", "Event Type", "User Email", "Detail"])
        if hasattr(models, "AuditLogDB"):
            for l in db.query(models.AuditLogDB).order_by(models.AuditLogDB.id.desc()).limit(200).all():
                writer.writerow([l.id, getattr(l, "event_type", ""), getattr(l, "user_email", ""), getattr(l, "detail", "")])
    else:
        raise HTTPException(status_code=400, detail="Invalid export resource")

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=gradeflow-{resource}.csv"},
    )