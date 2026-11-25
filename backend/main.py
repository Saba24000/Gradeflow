from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import models
from database import Base, engine
from routers import admin, assignments, auth, groups

app = FastAPI(title="GradeFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def init_db():
    Base.metadata.create_all(bind=engine)
    # Self-heal legacy users/assignments tables if old columns exist
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Student';"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(255);"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();"))
        conn.execute(text("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS group_id INTEGER;"))
        conn.execute(text("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS assigned_to_id INTEGER;"))


@app.on_event("startup")
def on_startup():
    init_db()


# Run immediately on serverless cold-start as well
try:
    init_db()
except Exception:
    pass


app.include_router(auth.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}