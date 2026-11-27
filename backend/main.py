import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import models
from auth import hash_password
from database import Base, SessionLocal, engine
from routers import admin, assignments, auth, groups

# 1. Create all database tables
Base.metadata.create_all(bind=engine)

# 2. Safely apply any missing columns on existing databases
dialect = engine.dialect.name
alter_statements = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100) DEFAULT ''",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT",
    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS group_id INTEGER",
    "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS owner_id INTEGER",
]

with engine.begin() as conn:
    for stmt in alter_statements:
        try:
            conn.execute(text(stmt))
        except Exception:
            pass


# 3. Auto-seed the 10 faculty test accounts after tables & columns exist
def seed_faculty_test_accounts():
    db = SessionLocal()
    try:
        # 5 Admin Accounts: student01..05@example.com | 12345678
        for i in range(1, 6):
            email = f"student0{i}@example.com"
            user = db.query(models.UserDB).filter(models.UserDB.email == email).first()
            if not user:
                db.add(
                    models.UserDB(
                        name=f"Admin Student 0{i}",
                        email=email,
                        hashed_password=hash_password("12345678"),
                        role="admin",
                        is_banned=False,
                    )
                )
            else:
                user.role = "admin"
                user.is_banned = False
                user.hashed_password = hash_password("12345678")

        # 5 Regular User Accounts: user01..05@example.com | 12345678
        for i in range(1, 6):
            email = f"user0{i}@example.com"
            user = db.query(models.UserDB).filter(models.UserDB.email == email).first()
            if not user:
                db.add(
                    models.UserDB(
                        name=f"Student User 0{i}",
                        email=email,
                        hashed_password=hash_password("12345678"),
                        role="user",
                        is_banned=False,
                    )
                )
            else:
                user.role = "user"
                user.is_banned = False
                user.hashed_password = hash_password("12345678")

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Seed warning: {e}")
    finally:
        db.close()


seed_faculty_test_accounts()

# 4. Initialize FastAPI application
app = FastAPI(title="GradeFlow API", version="2.0.0")

frontend_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://gradeflow-tau.vercel.app",
]
extra_origin = os.getenv("FRONTEND_URL")
if extra_origin:
    frontend_origins.append(extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. Mount API routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "GradeFlow API"}