from pydantic import BaseModel
from typing import Optional


class UserCreate(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    role: str

    class Config:
        from_attributes = True


class AssignmentBase(BaseModel):
    title: str
    course_code: str
    description: Optional[str] = ""
    due_date: str
    status: Optional[str] = "pending"
    group_id: Optional[int] = None
    assigned_to_id: Optional[int] = None 
    file_name: Optional[str] = ""
    file_data: Optional[str] = ""


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    course_code: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    group_id: Optional[int] = None
    assigned_to_id: Optional[int] = None 
    file_name: Optional[str] = None
    file_data: Optional[str] = None


class AssignmentResponse(AssignmentBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True