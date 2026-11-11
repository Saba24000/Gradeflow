# Technical Design Document (TDD) - GradeFlow

## 1. System Architecture
GradeFlow follows a decoupled client-server architecture:
* **Frontend**: React (TypeScript) initialized with Vite.
* **Backend**: FastAPI (Python) web server running on Uvicorn.
* **Database**: SQLite (MVP local) transitioning to PostgreSQL (Beta cloud).

## 2. API Design & Scopes

### MVP Endpoints (Local REST API)
* `GET /api/assignments`: Fetch list of active assignments **[MVP]**
* `POST /api/assignments`: Create new assignment **[MVP]**
* `POST /api/submissions`: Submit student work **[MVP]**
* `POST /api/grades`: Grade student submission **[MVP]**

### Beta Endpoints (Auth & RBAC)
* `POST /api/auth/register`: User registration **[Beta]**
* `POST /api/auth/login`: Issue JWT token **[Beta]**
* `GET /api/users/me`: Return authenticated profile dashboard data **[Beta]**

## 3. Data Schema
```json
{
  "User": { "id": "int", "email": "string", "role": "string" },
  "Assignment": { "id": "int", "title": "string", "due_date": "datetime" },
  "Submission": { "id": "int", "assignment_id": "int", "student_id": "int", "grade": "float" }
}