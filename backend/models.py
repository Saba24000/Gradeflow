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
    role = Column(String(20), default="user", nullable=False)  # "user" or "admin"
    is_banned = Column(Boolean, default=False, nullable=False)
    ban_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    assignments = relationship("AssignmentDB", back_populates="owner", foreign_keys="AssignmentDB.owner_id")
    sessions = relationship("RefreshSessionDB", back_populates="user", cascade="all, delete-orphan")


class RefreshSessionDB(Base):
    __tablename__ = "refresh_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    user_agent = Column(String(255), default="unknown")
    ip_address = Column(String(64), default="unknown")
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("UserDB", back_populates="sessions")


class GroupDB(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, default="")
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    members = relationship("GroupMemberDB", back_populates="group", cascade="all, delete-orphan")


class GroupMemberDB(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Comma-separated permissions: "create", "update", "assign"
    permissions = Column(String(100), default="create", nullable=False)

    group = relationship("GroupDB", back_populates="members")
    user = relationship("UserDB")


class AssignmentDB(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    course_code = Column(String(50), nullable=False)
    description = Column(Text, default="")
    due_date = Column(String(50), nullable=False)
    status = Column(String(30), default="pending", nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    owner = relationship("UserDB", back_populates="assignments", foreign_keys=[owner_id])


class AuditLogDB(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), default="")
    event_type = Column(String(64), nullable=False)
    detail = Column(Text, default="")
    ip_address = Column(String(64), default="unknown")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)