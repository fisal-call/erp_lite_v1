"""
app/modules/cost_centers/schemas.py
Pydantic DTOs for the cost_centers module.
"""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.shared.schemas import AuditFieldsRead, ORMBase


class CostCenterCreate(BaseModel):
    cost_center_code: str = Field(max_length=50)
    cost_center_name: str = Field(max_length=200)
    parent_cost_center_uuid: UUID | None = None


class CostCenterUpdate(BaseModel):
    """Partial update. `expected_version_no` implements PDR-001 Optimistic Locking.
    cost_center_code is NOT editable (stable external identifier, like customer_code)."""

    cost_center_name: str | None = Field(default=None, max_length=200)
    is_active: bool | None = None
    expected_version_no: int


class CostCenterRead(ORMBase, AuditFieldsRead):
    uuid: UUID
    cost_center_code: str
    cost_center_name: str
    parent_cost_center_uuid: UUID | None = None
    is_active: bool
