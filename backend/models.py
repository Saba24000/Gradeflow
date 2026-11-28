from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from database import Base


def utcnow():
    return datetime.now(timezone.utc)


class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user", nullable=False)
    is_banned = Column(Boolean, default=False, nullable=False)
    ban_reason = Column(String(255), nullable=True)
    institute = Column(String(150), default="", nullable=True)
    department = Column(String(120), default="", nullable=True)
    bio = Column(Text, default="", nullable=True)
    avatar_url = Column(Text, default="", nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    assignments = relationship("AssignmentDB", back_populates="owner")
    sessions = relationship("RefreshSessionDB", back_populates="user")


class RefreshSessionDB(Base):
    __tablename__ = "refresh_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    user_agent = Column(String(255), default="unknown")
    ip_address = Column(String(64), default="unknown")
    revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("UserDB", back_populates="sessions")


class StudyGroupDB(Base):
    __tablename__ = "study_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class GroupMemberDB(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="editor", nullable=False)


class AssignmentDB(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    course_code = Column(String(50), nullable=False)
    description = Column(Text, default="")
    due_date = Column(String(50), default="")
    status = Column(String(30), default="pending")
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    group_id = Column(Integer, ForeignKey("study_groups.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    owner = relationship("UserDB", back_populates="assignments")


class AuditLogDB(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(60), nullable=False)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), default="")
    ip_address = Column(String(64), default="")
    detail = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)