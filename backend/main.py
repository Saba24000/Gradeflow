import os
import sys

# Ensure /var/task/backend is on Python's import path on Vercel
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
from auth import hash_password
from database import Base, engine
from routers import admin, assignments, auth, groups

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


def init_db_and_seed():
    try:
        Base.metadata.create_all(bind=engine)

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

        with Session(bind=engine) as db:
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
        print(f"Startup DB/Seed warning: {e}")


@app.on_event("startup")
def on_startup():
    init_db_and_seed()


app.include_router(auth.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "GradeFlow API"}