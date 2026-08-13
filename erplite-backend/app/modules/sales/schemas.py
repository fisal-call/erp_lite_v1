"""
app/modules/sales/schemas.py
Pydantic DTOs for the sales module's public API contract.
Read DTOs expose `uuid` only — never the internal `id` (ERP-003 Part 5 §1).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.shared.schemas import AuditFieldsRead, ORMBase, UuidRef

# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------


class CustomerCreate(BaseModel):
    customer_code: str = Field(max_length=50)
    customer_name: str = Field(max_length=200)
    # NOTE: payment_term_uuid intentionally omitted — no PaymentTermLookupPort
    # wired into CustomerService; the column customer.payment_term_id exists as
    # nullable. Re-add when payment-term resolution is implemented end-to-end.
    credit_limit: Decimal | None = Field(default=None, ge=0)
    phone: str | None = None
    email: EmailStr | None = None
    custom_fields: dict | None = None


class CustomerUpdate(BaseModel):
    """Partial update. `expected_version_no` implements PDR-001 Optimistic Locking —
    the Service Layer rejects the update if it does not match the current row."""

    customer_name: str | None = None
    credit_limit: Decimal | None = Field(default=None, ge=0)
    phone: str | None = None
    email: EmailStr | None = None
    is_active: bool | None = None
    custom_fields: dict | None = None
    expected_version_no: int


class CustomerRead(ORMBase, AuditFieldsRead):
    uuid: UUID
    customer_code: str
    customer_name: str
    credit_limit: Decimal | None
    phone: str | None
    email: str | None
    is_active: bool
    custom_fields: dict | None


# ---------------------------------------------------------------------------
# Sales Order
# ---------------------------------------------------------------------------


class SalesOrderLineCreate(BaseModel):
    item_uuid: UUID
    qty_ordered: Decimal = Field(gt=0)
    rate: Decimal = Field(ge=0)
    # NOTE: tax_rate_uuid intentionally omitted — tax calculation is not yet
    # implemented in the Service Layer (no TaxRate model, no tax engine).
    # The DB column sales_order_line.tax_rate_id exists as nullable for future
    # use, but the API must not accept values it silently drops. See
    # ERP_LITE_V1_FINAL_AUDIT.md → Tax Support (Deferred).


class SalesOrderCreate(BaseModel):
    customer_uuid: UUID
    document_date: date
    currency_uuid: UUID
    # NOTE: branch_uuid intentionally omitted — BranchLookupPort is not yet
    # wired into the SalesOrderService (router passes branch_id=None).
    # The DB column sales_order.branch_id exists as nullable. Re-add this
    # field when branch resolution is implemented end-to-end.
    lines: list[SalesOrderLineCreate] = Field(min_length=1)  # BR-SAL-002 style: no empty order
    custom_fields: dict | None = None


class SalesOrderLineRead(BaseModel):
    item_uuid: UUID
    qty_ordered: Decimal
    rate: Decimal


class SalesOrderSummaryRead(ORMBase):
    """Lightweight list-view DTO (no lines, no nested customer resolve) —
    additive-only, used by GET /sales-orders (list). Full detail stays on
    SalesOrderRead via GET /sales-orders/{uuid}."""

    uuid: UUID
    document_number: str
    document_date: date
    status: str


class SalesOrderRead(ORMBase, AuditFieldsRead):
    uuid: UUID
    document_number: str
    customer: UuidRef
    document_date: date
    status: str
    lines: list[SalesOrderLineRead]
    custom_fields: dict | None


class SalesOrderSubmit(BaseModel):
    """Empty-bodied action DTOs are still explicit types (not raw dict) so the
    OpenAPI contract documents the endpoint's intent clearly."""

    expected_version_no: int
