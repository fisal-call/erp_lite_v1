"""
app/modules/sales/models.py

SQLAlchemy ORM models for the `sales` schema. Every column here MUST match
ERP-Lite-003-Purchasing-Sales.sql exactly — this file is a Python projection
of that SQL, not an independent design. If the two ever disagree, the SQL
file is correct and this file has a bug.

Cross-module references (company_id, branch_id, currency_id, payment_term_id,
item_id, tax_rate_id) are kept as plain FK columns WITHOUT an ORM relationship()
to another module's model class — modules do not import each other's models,
matching the module-boundary rule in BACKEND_ARCHITECTURE.md §2. Any data needed
from another module is fetched by calling that module's Service, not by
traversing an ORM relationship across schemas.
"""
from __future__ import annotations

import uuid as uuid_pkg
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.orm_base import Base


class Customer(Base):
    __tablename__ = "customer"
    __table_args__ = (
        UniqueConstraint("company_id", "customer_code", name="uq_customer__company_code"),
        {"schema": "sales"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    customer_code: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    payment_term_id: Mapped[int | None] = mapped_column(nullable=True)
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[int | None] = mapped_column(nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[int | None] = mapped_column(nullable=True)
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    sales_orders: Mapped[list["SalesOrder"]] = relationship(back_populates="customer")


class SalesOrder(Base):
    __tablename__ = "sales_order"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uq_sales_order__doc_number"),
        CheckConstraint(
            "status IN ('draft','submitted','approved','rejected','cancelled','closed','archived')",
            name="ck_sales_order__status",
        ),
        {"schema": "sales"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    branch_id: Mapped[int | None] = mapped_column(nullable=True)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("sales.customer.id"), nullable=False)
    sales_quotation_id: Mapped[int | None] = mapped_column(nullable=True)
    document_date: Mapped[date] = mapped_column(Date, nullable=False)
    currency_id: Mapped[int] = mapped_column(nullable=False)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False, server_default="1")
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="draft")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[int | None] = mapped_column(nullable=True)
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="sales_orders")
    lines: Mapped[list["SalesOrderLine"]] = relationship(back_populates="sales_order", cascade="all, delete-orphan")


class SalesOrderLine(Base):
    """Line table: minimal standard columns only (id, created/updated, version_no) —
    no uuid/is_deleted/is_active/custom_fields, per ERP-004 §5 Line-table exception."""

    __tablename__ = "sales_order_line"
    __table_args__ = ({"schema": "sales"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales.sales_order.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(nullable=False)
    qty_ordered: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    tax_rate_id: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[int | None] = mapped_column(nullable=True)
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")

    sales_order: Mapped["SalesOrder"] = relationship(back_populates="lines")
