"""
app/modules/accounting/models.py
Mirrors ERP-Lite-004-Accounting-Partitions.sql `accounting` schema (Account +
JournalEntry only — GeneralLedgerEntry is written by the DB/Service layer as a
posting side-effect, not directly via API; Cash/Bank deferred as next step).
"""
from __future__ import annotations

import uuid as uuid_pkg
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sqlalchemy.dialects.postgresql import UUID

from app.shared.orm_base import Base


class Account(Base):
    __tablename__ = "account"
    __table_args__ = (
        UniqueConstraint("company_id", "account_code", name="uq_account__company_code"),
        CheckConstraint("account_type IN ('asset','liability','equity','revenue','expense')", name="ck_account__type"),
        {"schema": "accounting"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    account_code: Mapped[str] = mapped_column(String(30), nullable=False)
    account_name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False)
    parent_account_id: Mapped[int | None] = mapped_column(nullable=True)
    is_group: Mapped[bool] = mapped_column(nullable=False, server_default="false")  # BR-ACC-006
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")


class JournalEntry(Base):
    __tablename__ = "journal_entry"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uq_journal_entry__doc_number"),
        CheckConstraint("status IN ('draft','submitted','cancelled')", name="ck_journal_entry__status"),
        {"schema": "accounting"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    branch_id: Mapped[int | None] = mapped_column(nullable=True)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    fiscal_year_id: Mapped[int] = mapped_column(nullable=False)
    narration: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="draft")
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(nullable=True)

    lines: Mapped[list["JournalEntryLine"]] = relationship(back_populates="journal_entry", cascade="all, delete-orphan")


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_line"
    __table_args__ = ({"schema": "accounting"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    journal_entry_id: Mapped[int] = mapped_column(ForeignKey("accounting.journal_entry.id"), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounting.account.id"), nullable=False)
    debit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, server_default="0")
    credit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    version_no: Mapped[int] = mapped_column(nullable=False, server_default="1")

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="lines")


class GeneralLedgerEntry(Base):
    """General Ledger partitioned table — written by the Service Layer on
    JournalEntry.submit() as a posting side-effect. Each JournalEntry line
    produces exactly one GL entry pointing back to its source via
    (source_doctype='JournalEntry', source_uuid=entry.uuid)."""
    __tablename__ = "general_ledger_entry"
    __table_args__ = ({"schema": "accounting"},)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=func.gen_random_uuid())
    company_id: Mapped[int] = mapped_column(nullable=False)
    branch_id: Mapped[int | None] = mapped_column(nullable=True)
    tenant_id: Mapped[int] = mapped_column(nullable=False, server_default="1")
    account_id: Mapped[int] = mapped_column(ForeignKey("accounting.account.id"), nullable=False)
    fiscal_period_id: Mapped[int] = mapped_column(nullable=False)
    debit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, server_default="0")
    credit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, server_default="0")
    transaction_currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="EGP")
    reporting_currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="EGP")
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, server_default="1")
    source_doctype: Mapped[str] = mapped_column(String(50), nullable=False)
    source_uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
