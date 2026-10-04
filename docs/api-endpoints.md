# REST API Endpoints Overview

## Authentication
- POST /api/auth/login - Login user and issue token
- GET /api/auth/me - Get active user details and scopes

## Assignments
- GET /api/assignments - View list of assignments
- POST /api/assignments - Create new assignment (Instructor)

## Submissions
- POST /api/submissions - Submit assignment work (Student)
- PATCH /api/submissions/{id}/grade - Grade submission (Instructor)