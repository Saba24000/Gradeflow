from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import auth, models
from database import get_db

router = APIRouter(prefix="/admin", tags=["Admin"])

class RoleUpdate(BaseModel):
    role: str

def require_admin(current_user: models.UserDB = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: models.UserDB = Depends(require_admin)):
    total_users = db.query(models.UserDB).count()
    total_assignments = db.query(models.AssignmentDB).count()
    admin_count = db.query(models.UserDB).filter(models.UserDB.role == "admin").count()
    return {
        "total_users": total_users,
        "total_assignments": total_assignments,
        "admin_count": admin_count,
        "regular_user_count": total_users - admin_count,
    }

@router.get("/users")
def get_all_users(db: Session = Depends(get_db), _: models.UserDB = Depends(require_admin)):
    return db.query(models.UserDB).all()

@router.patch("/users/{user_id}/role")
def update_role(user_id: int, payload: RoleUpdate, db: Session = Depends(get_db), _: models.UserDB = Depends(require_admin)):
    user = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user