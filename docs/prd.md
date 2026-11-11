# Product Requirements Document (PRD) - GradeFlow

## 1. Product Overview
GradeFlow is an online assignment and grading management platform designed to streamline course assignment submission and evaluation for students and instructors.

## 2. Release Milestones

### Release 1: MVP (Mid-term Demo)
* **[MVP] Assignment CRUD**: Instructors can create, read, update, and delete assignments locally via REST APIs.
* **[MVP] Submission System**: Students can upload local text/file assignment submissions.
* **[MVP] Basic Grading**: Instructors can view student submissions and assign grades/feedback.

### Release 2: Beta (Final Demo)
* **[Beta] User Authentication**: Secure login and registration using JWT tokens.
* **[Beta] Role-Based Access Control (RBAC)**: Distinct permissions for Admin, Instructor, and Student roles.
* **[Beta] User Profile Dashboard**: Tailored views showing pending assignments (Students) or class averages (Instructors).
* **[Beta] Cloud Deployment**: Deployed application accessible via public cloud infrastructure (e.g., Render / Vercel).