# Software Requirements Specification (SRS) - GradeFlow

## 1. Functional Requirements

### 1.1 Core Features (Mid-term)
* **FR-01 [MVP]**: The system shall allow creation and management of course assignment records.
* **FR-02 [MVP]**: The system shall process assignment submissions with timestamps.
* **FR-03 [MVP]**: The system shall allow instructors to attach grades and feedback text to submissions.

### 1.2 Advanced Features (Final Demo)
* **FR-04 [Beta]**: The system shall authenticate users via password hashing and JWT authorization headers.
* **FR-05 [Beta]**: The system shall enforce Role-Based Access Control (RBAC) across API endpoints.
* **FR-06 [Beta]**: The system shall display personalized user profile analytics dashboards.

## 2. Non-Functional Requirements
* **NFR-01 [MVP]**: Response time for REST API endpoints must be under 200ms locally.
* **NFR-02 [Beta]**: Passwords must be hashed using bcrypt or Argon2 prior to storage.
* **NFR-03 [Beta]**: CORS policy must restrict API access solely to authorized frontend domain origins.