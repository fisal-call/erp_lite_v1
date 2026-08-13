"""
app/modules/inventory/models.py
Mirrors ERP-Lite-002-Inventory.sql exactly.
"""
from __future__ import annotations

import uuid as uuid_pkg
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.orm_base import Base


class ItemCategory(Base):
    __tablename__ = "item_category"
    __table_args__ = ({"schema": "inventory"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    category_name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")


class Item(Base):
    __tablename__ = "item"
    __table_args__ = (
        UniqueConstraint("company_id", "item_code", name="uq_item__company_code"),
        {"schema": "inventory"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    item_code: Mapped[str] = mapped_column(String(50), nullable=False)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    item_category_id: Mapped[int] = mapped_column(ForeignKey("inventory.item_category.id"), nullable=False)
    base_uom_id: Mapped[int] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Warehouse(Base):
    __tablename__ = "warehouse"
    __table_args__ = ({"schema": "inventory"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    branch_id: Mapped[int | None] = mapped_column(nullable=True)
    warehouse_name: Mapped[str] = mapped_column(String(200), nullable=False)
    allow_negative_stock: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class StockLedgerEntry(Base):
    """Append-only — no Repository.add() writer exposed via API directly;
    only created as a side effect of StockAdjustment/PurchaseReceipt/SalesDelivery
    (BR-INV-002). Mapped read-only here for reporting/balance queries."""

    __tablename__ = "stock_ledger_entry"
    __table_args__ = ({"schema": "inventory"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True))
    company_id: Mapped[int] = mapped_column(nullable=False)
    item_id: Mapped[int] = mapped_column(nullable=False)
    warehouse_id: Mapped[int] = mapped_column(nullable=False)
    qty_change: Mapped[float] = mapped_column(nullable=False)
    source_doctype: Mapped[str] = mapped_column(String(100), nullable=False)
    source_uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    posting_date: Mapped[datetime] = mapped_column(nullable=False)

