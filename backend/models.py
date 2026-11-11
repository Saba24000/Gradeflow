from sqlalchemy import Column, Integer, String
from database import Base

class AssignmentDB(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    course_code = Column(String)
    description = Column(String)
    due_date = Column(String)