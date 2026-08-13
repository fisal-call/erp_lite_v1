"""
app/modules/core_org/models.py
Mirrors ERP-Lite-001-System-Security-Core.sql `core` schema (subset needed so far).
"""
from __future__ import annotations

import uuid as uuid_pkg
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.orm_base import Base


class Country(Base):
    __tablename__ = "country"
    __table_args__ = ({"schema": "core"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    iso_code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    name_ar: Mapped[str] = mapped_column(String(150), nullable=False)
    name_en: Mapped[str] = mapped_column(String(150), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")


class Currency(Base):
    __tablename__ = "currency"
    __table_args__ = ({"schema": "core"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    iso_code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    name_ar: Mapped[str] = mapped_column(String(100), nullable=False)
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")


class Company(Base):
    __tablename__ = "company"
    __table_args__ = ({"schema": "core"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_currency_id: Mapped[int] = mapped_column(ForeignKey("core.currency.id"), nullable=False)
    country_id: Mapped[int] = mapped_column(ForeignKey("core.country.id"), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, server_default="Africa/Cairo")
    inventory_valuation_method: Mapped[str] = mapped_column(String(20), nullable=False, server_default="weighted_average")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Branch(Base):
    __tablename__ = "branch"
    __table_args__ = ({"schema": "core"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(ForeignKey("core.company.id"), nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    branch_name: Mapped[str] = mapped_column(String(200), nullable=False)
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    custom_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class FiscalYear(Base):
    __tablename__ = "fiscal_year"
    __table_args__ = ({"schema": "core"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(ForeignKey("core.company.id"), nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    year_label: Mapped[str] = mapped_column(String(20), nullable=False)
    start_date: Mapped[date] = mapped_column(nullable=False)
    end_date: Mapped[date] = mapped_column(nullable=False)
    is_closed: Mapped[bool] = mapped_column(nullable=False, server_default="false")


class UnitOfMeasure(Base):
    __tablename__ = "unit_of_measure"
    __table_args__ = ({"schema": "core"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    uom_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
