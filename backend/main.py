import traceback
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import models
from database import Base, engine

app = FastAPI(title="GradeFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STARTUP_ERRORS = []


def init_db():
    Base.metadata.create_all(bind=engine)
    dialect = engine.dialect.name
    alter_statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Student'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(255)",
        "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS group_id INTEGER",
        "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS assigned_to_id INTEGER",
    ]
    if dialect == "postgresql":
        alter_statements.append(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        )
    else:
        alter_statements.append(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP"
        )

    with engine.begin() as conn:
        for stmt in alter_statements:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass


try:
    init_db()
except Exception:
    STARTUP_ERRORS.append(traceback.format_exc())


for router_name in ["auth", "assignments", "groups", "admin"]:
    try:
        mod = __import__(f"routers.{router_name}", fromlist=["router"])
        app.include_router(mod.router, prefix="/api")
    except Exception:
        STARTUP_ERRORS.append(f"Router {router_name} failed:\n" + traceback.format_exc())


@app.get("/api/health")
def health():
    return {
        "status": "ok" if not STARTUP_ERRORS else "degraded",
        "dialect": engine.dialect.name,
        "errors": STARTUP_ERRORS,
    }