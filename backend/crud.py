from sqlalchemy.orm import Session
import models, schemas

def get_assignments(db: Session):
    return db.query(models.AssignmentDB).all()

def get_assignment_by_id(db: Session, assignment_id: int):
    return db.query(models.AssignmentDB).filter(models.AssignmentDB.id == assignment_id).first()

def create_assignment(db: Session, assignment: schemas.AssignmentCreate):
    db_item = models.AssignmentDB(**assignment.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def update_assignment(db: Session, assignment_id: int, assignment: schemas.AssignmentCreate):
    db_item = db.query(models.AssignmentDB).filter(models.AssignmentDB.id == assignment_id).first()
    if db_item:
        for key, value in assignment.model_dump().items():
            setattr(db_item, key, value)
        db.commit()
        db.refresh(db_item)
    return db_item

def delete_assignment(db: Session, assignment_id: int):
    db_item = db.query(models.AssignmentDB).filter(models.AssignmentDB.id == assignment_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return db_itemfrom sqlalchemy.orm import Session
import models, schemas

def get_assignments(db: Session):
    return db.query(models.AssignmentDB).all()

def get_assignment_by_id(db: Session, assignment_id: int):
    return db.query(models.AssignmentDB).filter(models.AssignmentDB.id == assignment_id).first()

def create_assignment(db: Session, assignment: schemas.AssignmentCreate):
    db_item = models.AssignmentDB(**assignment.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def update_assignment(db: Session, assignment_id: int, assignment: schemas.AssignmentCreate):
    db_item = db.query(models.AssignmentDB).filter(models.AssignmentDB.id == assignment_id).first()
    if db_item:
        for key, value in assignment.model_dump().items():
            setattr(db_item, key, value)
        db.commit()
        db.refresh(db_item)
    return db_item

def delete_assignment(db: Session, assignment_id: int):
    db_item = db.query(models.AssignmentDB).filter(models.AssignmentDB.id == assignment_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
    return db_item