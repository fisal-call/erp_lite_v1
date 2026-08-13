"""
app/modules/security/models.py
Mirrors ERP-Lite-001-System-Security-Core.sql `security` schema exactly.
"""
from __future__ import annotations

import uuid as uuid_pkg
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.orm_base import Base


class AppUser(Base):
    __tablename__ = "app_user"
    __table_args__ = ({"schema": "security"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Role(Base):
    __tablename__ = "role"
    __table_args__ = ({"schema": "security"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    role_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")


class UserRoleAssignment(Base):
    __tablename__ = "user_role_assignment"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_role_assignment__user_role"),
        {"schema": "security"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("security.app_user.id"), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("security.role.id"), nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class UserCompanyAccess(Base):
    """Drives the RLS session context: the set of company_ids issued into a
    user's JWT at login time comes from this table (see security/service.py)."""

    __tablename__ = "user_company_access"
    __table_args__ = (
        UniqueConstraint("user_id", "company_id", "branch_id", name="uq_user_company_access__scope"),
        {"schema": "security"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("security.app_user.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(nullable=False)
    branch_id: Mapped[int | None] = mapped_column(nullable=True)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
