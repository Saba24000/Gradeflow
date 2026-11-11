from pydantic import BaseModel
from typing import Optional

class AssignmentBase(BaseModel):
    title: str
    course_code: str
    description: Optional[str] = None
    due_date: str

class AssignmentCreate(AssignmentBase):
    pass

class AssignmentResponse(AssignmentBase):
    id: int

    class Config:
        from_attributes = True