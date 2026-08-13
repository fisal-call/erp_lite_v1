"""
app/modules/accounting/schemas.py
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.shared.schemas import ORMBase


class AccountCreate(BaseModel):
    account_code: str = Field(max_length=30)
    account_name: str = Field(max_length=200)
    account_type: str
    is_group: bool = False
    parent_account_uuid: UUID | None = None


class AccountRead(ORMBase):
    uuid: UUID
    account_code: str
    account_name: str
    account_type: str
    is_group: bool
    is_active: bool


class JournalEntryLineCreate(BaseModel):
    account_uuid: UUID
    debit_amount: Decimal = Field(default=Decimal("0"), ge=0)
    credit_amount: Decimal = Field(default=Decimal("0"), ge=0)

    @model_validator(mode="after")
    def one_sided(self) -> "JournalEntryLineCreate":
        # BR-ACC mirror of ck_journal_entry_line__one_sided — validated at the DTO
        # level too (defense in depth: Service Layer must never trust transport alone).
        if (self.debit_amount > 0) == (self.credit_amount > 0):
            raise ValueError("Each line must have either a debit OR a credit, not both/neither.")
        return self


class JournalEntryCreate(BaseModel):
    posting_date: date
    narration: str | None = None
    lines: list[JournalEntryLineCreate] = Field(min_length=2)  # a balanced entry needs >= 2 lines

    @model_validator(mode="after")
    def balanced(self) -> "JournalEntryCreate":
        # BR-ACC-003: sum(debit) must equal sum(credit) — enforced here AND in the
        # Service Layer (the DTO check catches the common case fast; the Service
        # Layer check is the one that actually governs, per AD-004).
        total_debit = sum(line.debit_amount for line in self.lines)
        total_credit = sum(line.credit_amount for line in self.lines)
        if total_debit != total_credit:
            raise ValueError(f"Unbalanced entry: total debit {total_debit} != total credit {total_credit}")
        return self


class JournalEntryLineRead(BaseModel):
    account_uuid: UUID
    debit_amount: Decimal
    credit_amount: Decimal


class JournalEntrySummaryRead(ORMBase):
    """Lightweight list-view DTO (no lines) — same pattern as
    SalesOrderSummaryRead/PurchaseOrderSummaryRead, avoids the async
    lazy-load issue that a plain generic .list() would hit on .lines."""

    uuid: UUID
    document_number: str
    posting_date: date
    status: str


class JournalEntryRead(ORMBase):
    uuid: UUID
    document_number: str
    posting_date: date
    narration: str | None
    status: str
    lines: list[JournalEntryLineRead]
    version_no: int
