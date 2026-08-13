"""
app/modules/accounting/service.py
"""
from __future__ import annotations

from decimal import Decimal
from typing import Protocol
from uuid import UUID

from app.core.exceptions import BusinessRuleViolation, NotFoundError
from app.modules.accounting.models import Account, GeneralLedgerEntry, JournalEntry, JournalEntryLine
from app.modules.accounting.repository import AccountRepository, JournalEntryRepository
from app.modules.accounting.schemas import AccountCreate, JournalEntryCreate, JournalEntryLineRead, JournalEntryRead
from app.shared.document_numbering import next_document_number


class FiscalYearLookupPort(Protocol):
    async def get_open_fiscal_year_id(self, company_id: int) -> int | None: ...


class AccountService:
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def create(self, *, company_id: int, data: AccountCreate) -> Account:
        if await self.repo.get_by_code(company_id, data.account_code) is not None:
            raise BusinessRuleViolation("ACC-DUP", f"Account code '{data.account_code}' already exists.")

        parent_account_id: int | None = None
        if data.parent_account_uuid is not None:
            parent = await self.repo.get_by_uuid(data.parent_account_uuid)
            if parent is None or parent.company_id != company_id:
                raise BusinessRuleViolation("ACC-PARENT", f"Unknown parent account {data.parent_account_uuid}.")
            # Prevent cycles: a parent cannot be the account itself (uuid mismatch
            # is already enforced above; deeper cycle detection is out of ERP-Lite scope).
            parent_account_id = parent.id

        account = Account(
            company_id=company_id,
            account_code=data.account_code,
            account_name=data.account_name,
            account_type=data.account_type,
            is_group=data.is_group,
            parent_account_id=parent_account_id,
        )
        return await self.repo.add(account)


class JournalEntryService:
    def __init__(self, repo: JournalEntryRepository, account_repo: AccountRepository, fiscal_year_lookup: FiscalYearLookupPort):
        self.repo = repo
        self.account_repo = account_repo
        self.fiscal_year_lookup = fiscal_year_lookup

    async def create(self, *, company_id: int, branch_id: int | None, created_by: int, data: JournalEntryCreate) -> JournalEntryRead:
        # BR-ACC-003: sum(debit) == sum(credit) — DTO already validated this, but the
        # Service Layer is the actual governing check per AD-004 (re-verified here in
        # case a future caller bypasses the DTO validator, e.g. an internal service call).
        total_debit = sum(line.debit_amount for line in data.lines)
        total_credit = sum(line.credit_amount for line in data.lines)
        if total_debit != total_credit:
            raise BusinessRuleViolation("BR-ACC-003", f"Unbalanced entry: debit {total_debit} != credit {total_credit}")

        fiscal_year_id = await self.fiscal_year_lookup.get_open_fiscal_year_id(company_id)
        if fiscal_year_id is None:
            raise BusinessRuleViolation("BR-ACC-005", "No open fiscal year for this company.")

        document_number = await next_document_number(
            self.repo.session, company_id=company_id, doctype_name="JournalEntry", prefix="JE-"
        )

        entry = JournalEntry(
            company_id=company_id,
            branch_id=branch_id,
            document_number=document_number,
            posting_date=data.posting_date,
            fiscal_year_id=fiscal_year_id,
            narration=data.narration,
            status="draft",
            created_by=created_by,
        )
        for line_in in data.lines:
            account = await self.account_repo.get_by_uuid(line_in.account_uuid)
            if account is None or account.company_id != company_id:
                raise BusinessRuleViolation("BR-ACC-004", f"Unknown account {line_in.account_uuid}.")
            # BR-ACC-006: postings only allowed on non-group ("detail") accounts.
            if account.is_group:
                raise BusinessRuleViolation("BR-ACC-006", f"Cannot post to group account '{account.account_name}'.")
            entry.lines.append(
                JournalEntryLine(
                    account_id=account.id,
                    debit_amount=line_in.debit_amount,
                    credit_amount=line_in.credit_amount,
                )
            )

        await self.repo.add(entry)
        loaded = await self.repo.get_by_uuid_with_lines(entry.uuid)
        assert loaded is not None
        return await self._to_read_dto(loaded)

    async def _to_read_dto(self, entry: JournalEntry) -> JournalEntryRead:
        line_reads = [
            JournalEntryLineRead(
                account_uuid=await self._account_uuid(line.account_id),
                debit_amount=line.debit_amount,
                credit_amount=line.credit_amount,
            )
            for line in entry.lines
        ]
        return JournalEntryRead(
            uuid=entry.uuid,
            document_number=entry.document_number,
            posting_date=entry.posting_date,
            narration=entry.narration,
            status=entry.status,
            lines=line_reads,
            version_no=entry.version_no,
        )

    async def _account_uuid(self, account_id: int) -> UUID:
        account = await self.repo.session.get(Account, account_id)
        assert account is not None
        return account.uuid

    async def get(self, entry_uuid: UUID) -> JournalEntryRead:
        entry = await self.repo.get_by_uuid_with_lines(entry_uuid)
        if entry is None:
            raise NotFoundError("JournalEntry", str(entry_uuid))
        return await self._to_read_dto(entry)

    async def submit(self, entry_uuid: UUID) -> JournalEntryRead:
        """BR-ACC-001: once submitted, a JournalEntry becomes immutable — this is
        the ONLY transition allowed via API; there is no update/edit endpoint at
        all for a submitted entry (not just a version-locked one, per BR-ACC-001's
        stronger guarantee than ordinary optimistic locking).

        Side-effect: posting to the General Ledger. Each JournalEntryLine produces
        exactly one GeneralLedgerEntry row with (source_doctype='JournalEntry',
        source_uuid=entry.uuid) so the trial balance and other reporting views
        can pick it up. Idempotent: if GL entries already exist for this source,
        they are not re-created (defends against double-posting if submit is
        ever retried after a partial failure)."""
        entry = await self.repo.get_by_uuid_with_lines(entry_uuid)
        if entry is None:
            raise NotFoundError("JournalEntry", str(entry_uuid))
        if entry.status != "draft":
            raise BusinessRuleViolation("BR-ACC-001", f"Cannot submit a JournalEntry in status '{entry.status}'.")

        # Idempotency check — never double-post
        from sqlalchemy import select
        existing = await self.repo.session.execute(
            select(GeneralLedgerEntry.id).where(
                GeneralLedgerEntry.source_doctype == "JournalEntry",
                GeneralLedgerEntry.source_uuid == entry.uuid,
            ).limit(1)
        )
        if existing.scalar() is None:
            # Resolve fiscal_period_id from posting_date
            from sqlalchemy import text as sa_text
            period_row = await self.repo.session.execute(
                sa_text("SELECT id FROM core.fiscal_period WHERE fiscal_year_id = :fy_id AND :pdate BETWEEN start_date AND end_date LIMIT 1"),
                {"fy_id": entry.fiscal_year_id, "pdate": entry.posting_date},
            )
            period_id = period_row.scalar()
            if period_id is None:
                raise BusinessRuleViolation("BR-ACC-005",
                    f"No open fiscal period covers posting_date {entry.posting_date}.")
            # Insert one GL entry per JE line
            for line in entry.lines:
                gle = GeneralLedgerEntry(
                    company_id=entry.company_id,
                    branch_id=entry.branch_id,
                    account_id=line.account_id,
                    fiscal_period_id=period_id,
                    debit_amount=line.debit_amount,
                    credit_amount=line.credit_amount,
                    transaction_currency="EGP",
                    reporting_currency="EGP",
                    exchange_rate=Decimal("1"),
                    source_doctype="JournalEntry",
                    source_uuid=entry.uuid,
                    posting_date=entry.posting_date,
                )
                self.repo.session.add(gle)

        entry.status = "submitted"
        entry.version_no += 1
        await self.repo.flush()
        return await self._to_read_dto(entry)
