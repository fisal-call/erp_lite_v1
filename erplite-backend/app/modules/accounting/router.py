"""
app/modules/accounting/router.py
No PUT/PATCH endpoint exists for JournalEntry at all (not even version-locked) —
BR-ACC-001 is enforced by omission: the only mutating action after creation is /submit.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_token, get_current_user_id, get_db_with_context
from app.core.exceptions import BusinessRuleViolation, NotFoundError
from app.core.security import TokenPayload
from app.modules.accounting.repository import AccountRepository, JournalEntryRepository
from app.modules.accounting.schemas import AccountCreate, AccountRead, JournalEntryCreate, JournalEntryRead, JournalEntrySummaryRead
from app.modules.accounting.service import AccountService, JournalEntryService

router = APIRouter(prefix="/accounting", tags=["accounting"])


def _company_id(token: TokenPayload) -> int:
    return token.company_ids[0]


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, BusinessRuleViolation):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected error")


async def _je_service(db: AsyncSession = Depends(get_db_with_context)) -> JournalEntryService:
    from app.modules.core_org.service import FiscalYearLookupAdapter

    return JournalEntryService(JournalEntryRepository(db), AccountRepository(db), FiscalYearLookupAdapter(db))


@router.post("/accounts", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    token: TokenPayload = Depends(get_current_token),
    db: AsyncSession = Depends(get_db_with_context),
):
    service = AccountService(AccountRepository(db))
    try:
        return await service.create(company_id=_company_id(token), data=payload)
    except BusinessRuleViolation as exc:
        raise _http(exc) from exc


@router.get("/accounts", response_model=list[AccountRead])
async def list_accounts(db: AsyncSession = Depends(get_db_with_context)):
    repo = AccountRepository(db)
    rows, _ = await repo.list(limit=500, offset=0)
    return rows


@router.get("/journal-entries", response_model=list[JournalEntrySummaryRead])
async def list_journal_entries(
    search: str | None = Query(default=None, description="Search by document number (ILIKE)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db_with_context),
):
    """v1.0: server-side search on document_number + pagination.
    Note: JournalEntry has no is_deleted column (BR-ACC-001 — immutable once submitted)."""
    repo = JournalEntryRepository(db)
    if search:
        from sqlalchemy import select as sa_select
        from app.modules.accounting.models import JournalEntry as _JE
        pattern = f"%{search}%"
        stmt = (
            sa_select(_JE)
            .where(_JE.document_number.ilike(pattern))
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        rows = list((await db.execute(stmt)).scalars().all())
    else:
        rows, _ = await repo.list(limit=200, offset=0)
    return rows


@router.post("/journal-entries", response_model=JournalEntryRead, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    payload: JournalEntryCreate,
    token: TokenPayload = Depends(get_current_token),
    user_id: int = Depends(get_current_user_id),
    service: JournalEntryService = Depends(_je_service),
):
    try:
        return await service.create(
            company_id=_company_id(token), branch_id=None, created_by=user_id, data=payload
        )
    except BusinessRuleViolation as exc:
        raise _http(exc) from exc


@router.get("/journal-entries/{entry_uuid}", response_model=JournalEntryRead)
async def get_journal_entry(entry_uuid: UUID, service: JournalEntryService = Depends(_je_service)):
    try:
        return await service.get(entry_uuid)
    except NotFoundError as exc:
        raise _http(exc) from exc


@router.post("/journal-entries/{entry_uuid}/submit", response_model=JournalEntryRead)
async def submit_journal_entry(entry_uuid: UUID, service: JournalEntryService = Depends(_je_service)):
    try:
        return await service.submit(entry_uuid)
    except (NotFoundError, BusinessRuleViolation) as exc:
        raise _http(exc) from exc


# ---------------------------------------------------------------------------
# Trial Balance — reads from reporting.v_trial_balance (Phase 2 SQL view).
# The view aggregates accounting.general_ledger_entry per detail account; it is
# populated by JournalEntry.submit() (see service.py).
# ---------------------------------------------------------------------------
from sqlalchemy import text as _sa_text  # noqa: E402
from pydantic import BaseModel  # noqa: E402


class TrialBalanceRow(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    total_debit: float
    total_credit: float
    net_balance: float


@router.get("/trial-balance", response_model=list[TrialBalanceRow])
async def get_trial_balance(db: AsyncSession = Depends(get_db_with_context)):
    """Returns one row per detail account with totals from posted GL entries.
    Filtered to the caller's company via RLS (the view inherits RLS from
    accounting.general_ledger_entry)."""
    rows = await db.execute(_sa_text(
        "SELECT account_code, account_name, account_type, "
        "       total_debit::float, total_credit::float, net_balance::float "
        "FROM reporting.v_trial_balance "
        "ORDER BY account_code"
    ))
    return [TrialBalanceRow(**dict(r._mapping)) for r in rows]
