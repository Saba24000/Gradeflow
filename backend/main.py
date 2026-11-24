import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from routers import assignments
import models
from database import engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="GradeFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assignments.router)