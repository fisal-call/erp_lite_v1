"""
app/modules/purchasing/models.py
Mirrors ERP-Lite-003-Purchasing-Sales.sql `purchasing` schema (Supplier + PurchaseOrder only —
Receipt/Invoice/Payment follow the identical pattern, deferred as a documented next step).
"""
from __future__ import annotations

import uuid as uuid_pkg
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.orm_base import Base


class Supplier(Base):
    __tablename__ = "supplier"
    __table_args__ = (
        UniqueConstraint("company_id", "supplier_code", name="uq_supplier__company_code"),
        {"schema": "purchasing"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    supplier_code: Mapped[str] = mapped_column(String(50), nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[int | None] = mapped_column(nullable=True)
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="supplier")


class PurchaseOrder(Base):
    __tablename__ = "purchase_order"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uq_purchase_order__doc_number"),
        CheckConstraint(
            "status IN ('draft','submitted','approved','rejected','cancelled','closed','archived')",
            name="ck_purchase_order__status",
        ),
        {"schema": "purchasing"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    branch_id: Mapped[int | None] = mapped_column(nullable=True)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("purchasing.supplier.id"), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False)
    currency_id: Mapped[int] = mapped_column(nullable=False)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False, server_default="1")
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="draft")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(nullable=True)
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    supplier: Mapped["Supplier"] = relationship(back_populates="purchase_orders")
    lines: Mapped[list["PurchaseOrderLine"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")


class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_line"
    __table_args__ = ({"schema": "purchasing"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchasing.purchase_order.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(nullable=False)
    qty_ordered: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(nullable=True)
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="lines")
