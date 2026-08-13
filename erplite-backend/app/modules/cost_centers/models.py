"""
app/modules/cost_centers/models.py
SQLAlchemy ORM model for `core.cost_center` (ERP-Lite-008-CostCenters.sql).
"""
from __future__ import annotations

import uuid as uuid_pkg
from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.orm_base import Base


class CostCenter(Base):
    __tablename__ = "cost_center"
    __table_args__ = (
        UniqueConstraint("company_id", "cost_center_code", name="uq_cost_center__company_code"),
        {"schema": "core"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    cost_center_code: Mapped[str] = mapped_column(String(50), nullable=False)
    cost_center_name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_cost_center_id: Mapped[int | None] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[int | None] = mapped_column(nullable=True)
