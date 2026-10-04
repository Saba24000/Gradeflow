# Role-Based Access Control (RBAC) Matrix

| Role | Permissions / Scopes | Allowed Actions |
| :--- | :--- | :--- |
| **Admin** | `users:read`, `users:write` | Create user accounts and manage site roles |
| **Instructor** | `assignments:create`, `submissions:grade` | Create assignments, review & grade submissions |
| **Student** | `assignments:read`, `submissions:create` | View assignments, submit completed work |