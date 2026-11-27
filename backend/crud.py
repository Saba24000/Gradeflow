from sqlalchemy.orm import Session
from sqlalchemy import or_
import models, schemas


def get_assignments(db: Session, user: models.UserDB):
    if user.role == "admin":
        return db.query(models.AssignmentDB).all()

    user_group_ids = [
        m.group_id
        for m in db.query(models.GroupMemberDB)
        .filter(models.GroupMemberDB.user_id == user.id)
        .all()
    ]

    return (
        db.query(models.AssignmentDB)
        .filter(
            or_(
                models.AssignmentDB.owner_id == user.id,
                models.AssignmentDB.assigned_to_id == user.id,
                models.AssignmentDB.group_id.in_(user_group_ids),
            )
        )
        .all()
    )


def get_assignment_by_id(db: Session, assignment_id: int):
    return (
        db.query(models.AssignmentDB)
        .filter(models.AssignmentDB.id == assignment_id)
        .first()
    )


def create_assignment(
    db: Session, assignment: schemas.AssignmentCreate, owner_id: int
):
    data = assignment.model_dump()
    if data.get("description") is None:
        data["description"] = ""
    if not data.get("status"):
        data["status"] = "pending"

    db_item = models.AssignmentDB(**data, owner_id=owner_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_assignment(
    db: Session, assignment_id: int, assignment: schemas.AssignmentUpdate
):
    db_item = get_assignment_by_id(db, assignment_id)
    if db_item:
        for key, value in assignment.model_dump(exclude_unset=True).items():
            setattr(db_item, key, value)
        db.commit()
        db.refresh(db_item)
    return db_item


def delete_assignment(db: Session, assignment_id: int):
    db_item = get_assignment_by_id(db, assignment_id)
    if db_item:
        db.delete(db_item)
        db.commit()
    return db_item