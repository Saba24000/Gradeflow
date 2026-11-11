from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import schemas, crud
from database import get_db

router = APIRouter(prefix="/api/assignments", tags=["assignments"])

@router.get("", response_model=List[schemas.AssignmentResponse])
def read_assignments(db: Session = Depends(get_db)):
    return crud.get_assignments(db)

@router.get("/{assignment_id}", response_model=schemas.AssignmentResponse)
def read_assignment(assignment_id: int, db: Session = Depends(get_db)):
    item = crud.get_assignment_by_id(db, assignment_id)
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return item

@router.post("", response_model=schemas.AssignmentResponse)
def create_new_assignment(assignment: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    return crud.create_assignment(db, assignment)

@router.put("/{assignment_id}", response_model=schemas.AssignmentResponse)
def update_existing_assignment(assignment_id: int, assignment: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    item = crud.update_assignment(db, assignment_id, assignment)
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return item

@router.delete("/{assignment_id}")
def remove_assignment(assignment_id: int, db: Session = Depends(get_db)):
    item = crud.delete_assignment(db, assignment_id)
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"detail": "Deleted successfully"}