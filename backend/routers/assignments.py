from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, crud
from database import get_db
from auth import get_current_user  # Match the import used in routers/groups.py

router = APIRouter(prefix="/assignments", tags=["assignments"])


def _can_access_assignment(
    db: Session, user: models.UserDB, item: models.AssignmentDB
) -> bool:
    if user.role == "admin" or item.owner_id == user.id or item.assigned_to_id == user.id:
        return True
    if item.group_id is not None:
        membership = (
            db.query(models.GroupMemberDB)
            .filter(
                models.GroupMemberDB.group_id == item.group_id,
                models.GroupMemberDB.user_id == user.id,
            )
            .first()
        )
        return membership is not None
    return False


@router.get("", response_model=List[schemas.AssignmentResponse])
def read_assignments(
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    return crud.get_assignments(db, current_user)


@router.get("/{assignment_id}", response_model=schemas.AssignmentResponse)
def read_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    item = crud.get_assignment_by_id(db, assignment_id)
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not _can_access_assignment(db, current_user, item):
        raise HTTPException(status_code=403, detail="Not authorized")
    return item


@router.post("", response_model=schemas.AssignmentResponse, status_code=201)
def create_new_assignment(
    assignment: schemas.AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    if assignment.group_id is not None and current_user.role != "admin":
        membership = (
            db.query(models.GroupMemberDB)
            .filter(
                models.GroupMemberDB.group_id == assignment.group_id,
                models.GroupMemberDB.user_id == current_user.id,
            )
            .first()
        )
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this group")

    return crud.create_assignment(db, assignment, owner_id=current_user.id)


@router.put("/{assignment_id}", response_model=schemas.AssignmentResponse)
def update_existing_assignment(
    assignment_id: int,
    assignment: schemas.AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    item = crud.get_assignment_by_id(db, assignment_id)
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not _can_access_assignment(db, current_user, item):
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.update_assignment(db, assignment_id, assignment)


@router.delete("/{assignment_id}")
def remove_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    item = crud.get_assignment_by_id(db, assignment_id)
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if current_user.role != "admin" and item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner or admin can delete")
    crud.delete_assignment(db, assignment_id)
    return {"detail": "Deleted successfully"}