"""
app/shared/document_numbering.py
Thin wrapper around system.fn_next_document_number (ERP-Lite-006, Phase 2) — the
atomic, concurrency-safe counter validated under a real 30-way parallel test.
Every module's service.py calls this instead of touching document_number_counter
directly, so the SELECT...FOR UPDATE contract can never be bypassed accidentally.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def next_document_number(
    session: AsyncSession,
    *,
    company_id: int,
    doctype_name: str,
    prefix: str,
    fiscal_year_id: int | None = None,
) -> str:
    result = await session.execute(
        text(
            "SELECT system.fn_next_document_number("
            ":company_id, :doctype_name, :fiscal_year_id, :prefix)"
        ),
        {
            "company_id": company_id,
            "doctype_name": doctype_name,
            "fiscal_year_id": fiscal_year_id,
            "prefix": prefix,
        },
    )
    return result.scalar_one()
