"""
app/modules/core_org/router.py
Uses plain get_db: Company/Branch creation happens BEFORE any user could have
company-scoped RLS access to it (bootstrap problem, same class as security's
first-user creation) — and Currency/Country are global reference data, not
RLS-protected at all.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_db_bootstrap
from app.core.dependencies import require_bootstrap_or_admin
from app.core.exceptions import BusinessRuleViolation
from app.modules.core_org.repository import (
    BranchRepository,
    CompanyRepository,
    CountryRepository,
    CurrencyRepository,
    FiscalYearRepository,
    UnitOfMeasureRepository,
)
from app.modules.core_org.schemas import CompanyCreate, CompanyRead, CountryRead, CurrencyRead, UnitOfMeasureRead
from app.modules.core_org.service import CompanyService

router = APIRouter(prefix="/core", tags=["core-org"])


@router.post("/companies", response_model=CompanyRead, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_bootstrap_or_admin)])
async def bootstrap_company(payload: CompanyCreate, db: AsyncSession = Depends(get_db_bootstrap)):
    # SECURITY (resolved 2026-08-10, was Issue 5 in BACKEND_ISSUES.md):
    # Now gated by require_bootstrap_or_admin — same three-way gate as
    # POST /security/users (fresh-install escape / X-Bootstrap-Token / valid JWT).
    service = CompanyService(
        CompanyRepository(db), BranchRepository(db), CurrencyRepository(db), CountryRepository(db), FiscalYearRepository(db)
    )
    try:
        company = await service.bootstrap(payload)
        await db.commit()
    except BusinessRuleViolation as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return company


@router.get("/currencies", response_model=list[CurrencyRead])
async def list_currencies(db: AsyncSession = Depends(get_db)):
    repo = CurrencyRepository(db)
    return await repo.list_active()


@router.get("/countries", response_model=list[CountryRead])
async def list_countries(db: AsyncSession = Depends(get_db)):
    repo = CountryRepository(db)
    rows, _ = await repo.list(limit=200, offset=0)
    return rows


@router.get("/units-of-measure", response_model=list[UnitOfMeasureRead])
async def list_units_of_measure(db: AsyncSession = Depends(get_db)):
    repo = UnitOfMeasureRepository(db)
    return await repo.list_active()
