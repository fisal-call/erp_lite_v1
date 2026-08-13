"""
app/modules/accounting/repository.py
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.modules.accounting.models import Account, JournalEntry
from app.shared.base_repository import SqlAlchemyRepository


class AccountRepository(SqlAlchemyRepository[Account]):
    model = Account

    async def get_by_code(self, company_id: int, account_code: str) -> Account | None:
        stmt = select(Account).where(Account.company_id == company_id, Account.account_code == account_code)
        return (await self.session.execute(stmt)).scalar_one_or_none()


class JournalEntryRepository(SqlAlchemyRepository[JournalEntry]):
    """JournalEntry has NO `is_deleted` column (per ERP-Lite-004 DDL: only
    `account` has soft-delete in the accounting schema). The base
    SqlAlchemyRepository.list/get_by_uuid assume `is_deleted` exists, so we
    override them here to use plain select statements. This is consistent
    with BR-ACC-001 — submitted JournalEntries are immutable; deletion is
    not part of the accounting contract.
    """
    model = JournalEntry

    async def get_by_uuid(self, entity_uuid: UUID) -> JournalEntry | None:
        stmt = select(JournalEntry).where(JournalEntry.uuid == entity_uuid)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list(self, *, limit: int = 50, offset: int = 0, **filters: Any) -> tuple[list[JournalEntry], int]:
        stmt = select(JournalEntry)
        count_stmt = select(func.count()).select_from(JournalEntry)
        for field, value in filters.items():
            if value is None:
                continue
            column = getattr(JournalEntry, field)
            stmt = stmt.where(column == value)
            count_stmt = count_stmt.where(column == value)
        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = stmt.limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), total

    async def get_by_uuid_with_lines(self, entry_uuid: UUID) -> JournalEntry | None:
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.uuid == entry_uuid)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()
