"""
app/modules/inventory/schemas.py
"""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.shared.schemas import AuditFieldsRead, ORMBase


class ItemCategoryCreate(BaseModel):
    category_name: str = Field(max_length=150)


class ItemCategoryRead(ORMBase):
    uuid: UUID
    category_name: str
    is_active: bool


class ItemCreate(BaseModel):
    item_code: str = Field(max_length=50)
    item_name: str = Field(max_length=255)
    item_category_uuid: UUID
    base_uom_uuid: UUID
    custom_fields: dict | None = None


class ItemUpdate(BaseModel):
    """Partial update. `expected_version_no` implements PDR-001 Optimistic Locking.
    item_code is NOT editable (stable external identifier).
    item_category_uuid and base_uom_uuid are NOT editable here either — changing
    category or UoM mid-life has cascading effects on stock valuation and would
    require a documented migration process. Deactivate + recreate instead."""

    item_name: str | None = None
    is_active: bool | None = None
    custom_fields: dict | None = None
    expected_version_no: int


class ItemRead(ORMBase, AuditFieldsRead):
    uuid: UUID
    item_code: str
    item_name: str
    is_active: bool
    custom_fields: dict | None


class WarehouseCreate(BaseModel):
    warehouse_name: str = Field(max_length=200)
    # NOTE: branch_uuid intentionally omitted — no BranchLookupPort wired into
    # WarehouseService (see service.py comment about central-warehouse semantics).
    # The DB column warehouse.branch_id exists as nullable. Re-add when branch
    # resolution is implemented end-to-end.
    allow_negative_stock: bool = False  # BD-001: opt-in per warehouse


class WarehouseRead(ORMBase):
    uuid: UUID
    warehouse_name: str
    allow_negative_stock: bool
    is_active: bool


class StockBalanceRead(BaseModel):
    """Backed by reporting.v_stock_balance (Phase 2) — read-only, not an ORM table."""

    item_code: str
    item_name: str
    warehouse_name: str
    qty_on_hand: float
