from fastapi import FastAPI

app = FastAPI(title="GradeFlow API")

@app.get("/")
def read_root():
    return {"message": "GradeFlow Backend API is running"}
    