"""
app/modules/purchasing/schemas.py
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.shared.schemas import AuditFieldsRead, ORMBase, UuidRef


class SupplierCreate(BaseModel):
    supplier_code: str = Field(max_length=50)
    supplier_name: str = Field(max_length=200)
    phone: str | None = None
    email: EmailStr | None = None
    custom_fields: dict | None = None


class SupplierUpdate(BaseModel):
    """Partial update. `expected_version_no` implements PDR-001 Optimistic Locking —
    mirrors CustomerUpdate exactly. supplier_code is intentionally NOT editable
    (it's a stable external identifier referenced by integrations)."""

    supplier_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    is_active: bool | None = None
    custom_fields: dict | None = None
    expected_version_no: int


class SupplierRead(ORMBase, AuditFieldsRead):
    uuid: UUID
    supplier_code: str
    supplier_name: str
    phone: str | None
    email: str | None
    is_active: bool


class PurchaseOrderLineCreate(BaseModel):
    item_uuid: UUID
    qty_ordered: Decimal = Field(gt=0)
    rate: Decimal = Field(ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_uuid: UUID
    document_date: date
    currency_uuid: UUID
    lines: list[PurchaseOrderLineCreate] = Field(min_length=1)
    custom_fields: dict | None = None


class PurchaseOrderLineRead(BaseModel):
    item_uuid: UUID
    qty_ordered: Decimal
    rate: Decimal


class PurchaseOrderRead(ORMBase, AuditFieldsRead):
    uuid: UUID
    document_number: str
    supplier: UuidRef
    document_date: date
    status: str
    lines: list[PurchaseOrderLineRead]
    custom_fields: dict | None


class PurchaseOrderSummaryRead(ORMBase, AuditFieldsRead):
    """Lightweight list-view DTO — mirrors sales.SalesOrderSummaryRead exactly."""

    uuid: UUID
    document_number: str
    document_date: date
    status: str


class PurchaseOrderSubmit(BaseModel):
    expected_version_no: int
