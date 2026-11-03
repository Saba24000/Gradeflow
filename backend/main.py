from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="GradeFlow API", version="1.0.0")

# Enable CORS for Frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models (Data Schemas)
class AssignmentBase(BaseModel):
    title: str
    description: str
    course: str
    due_date: str
    total_points: int

class AssignmentCreate(AssignmentBase):
    pass

class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    course: Optional[str] = None
    due_date: Optional[str] = None
    total_points: Optional[int] = None

class Assignment(AssignmentBase):
    id: int

# In-Memory Database Store (MVP)
db_assignments: List[Assignment] = [
    Assignment(
        id=1,
        title="Database Schema Design",
        description="Design ERD diagram and write DDL scripts.",
        course="CSE327",
        due_date="2026-11-10",
        total_points=100
    ),
    Assignment(
        id=2,
        title="FastAPI REST Endpoints",
        description="Implement CRUD operations using FastAPI.",
        course="CSE327",
        due_date="2026-11-15",
        total_points=50
    )
]

# --- REST API Endpoints ---

# 1. READ LIST (Get All)
@app.get("/api/assignments", response_model=List[Assignment], status_code=status.HTTP_200_OK)
def get_assignments():
    return db_assignments

# 2. READ SINGLE (Get by ID)
@app.get("/api/assignments/{assignment_id}", response_model=Assignment, status_code=status.HTTP_200_OK)
def get_assignment(assignment_id: int):
    for assignment in db_assignments:
        if assignment.id == assignment_id:
            return assignment
    raise HTTPException(status_code=404, detail="Assignment not found")

# 3. CREATE (Post New)
@app.post("/api/assignments", response_model=Assignment, status_code=status.HTTP_201_CREATED)
def create_assignment(payload: AssignmentCreate):
    new_id = max([a.id for a in db_assignments], default=0) + 1
    new_assignment = Assignment(id=new_id, **payload.model_dump())
    db_assignments.append(new_assignment)
    return new_assignment

# 4. UPDATE (Put by ID)
@app.put("/api/assignments/{assignment_id}", response_model=Assignment, status_code=status.HTTP_200_OK)
def update_assignment(assignment_id: int, payload: AssignmentUpdate):
    for index, assignment in enumerate(db_assignments):
        if assignment.id == assignment_id:
            updated_data = assignment.model_dump()
            update_fields = payload.model_dump(exclude_unset=True)
            updated_data.update(update_fields)
            
            updated_assignment = Assignment(**updated_data)
            db_assignments[index] = updated_assignment
            return updated_assignment
    raise HTTPException(status_code=404, detail="Assignment not found")

# 5. DELETE (Remove by ID)
@app.delete("/api/assignments/{assignment_id}", status_code=status.HTTP_200_OK)
def delete_assignment(assignment_id: int):
    for index, assignment in enumerate(db_assignments):
        if assignment.id == assignment_id:
            deleted = db_assignments.pop(index)
            return {"message": f"Assignment '{deleted.title}' deleted successfully"}
    raise HTTPException(status_code=404, detail="Assignment not found")