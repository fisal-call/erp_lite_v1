"""
app/modules/core_org/service.py
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleViolation
from app.modules.core_org.models import Branch, Company
from app.modules.core_org.repository import (
    BranchRepository,
    CompanyRepository,
    CountryRepository,
    CurrencyRepository,
    FiscalYearRepository,
    UnitOfMeasureRepository,
)
from app.modules.core_org.schemas import CompanyCreate


class CompanyService:
    def __init__(
        self,
        company_repo: CompanyRepository,
        branch_repo: BranchRepository,
        currency_repo: CurrencyRepository,
        country_repo: CountryRepository,
        fiscal_year_repo: FiscalYearRepository,
    ):
        self.company_repo = company_repo
        self.branch_repo = branch_repo
        self.currency_repo = currency_repo
        self.country_repo = country_repo
        self.fiscal_year_repo = fiscal_year_repo

    async def bootstrap(self, data: CompanyCreate) -> Company:
        currency = await self.currency_repo.get_by_uuid(data.base_currency_uuid)
        if currency is None:
            raise BusinessRuleViolation("CORE-001", "Unknown base currency.")
        country = await self.country_repo.get_by_uuid(data.country_uuid)
        if country is None:
            raise BusinessRuleViolation("CORE-002", "Unknown country.")

        company = Company(
            company_name=data.company_name,
            base_currency_id=currency.id,
            country_id=country.id,
        )
        await self.company_repo.add(company)

        # ERP-004 §15.7: a company with zero branches is not independently usable —
        # every bootstrap creates the first branch in the same transaction.
        await self.branch_repo.add(Branch(company_id=company.id, branch_name=data.first_branch_name))

        # Likewise, a company with no open fiscal year cannot post any JournalEntry
        # (BR-ACC requires fiscal_year_id) — bootstrap the current calendar year.
        from datetime import date

        from app.modules.core_org.models import FiscalYear

        today = date.today()
        await self.fiscal_year_repo.add(
            FiscalYear(
                company_id=company.id,
                year_label=f"FY{today.year}",
                start_date=date(today.year, 1, 1),
                end_date=date(today.year, 12, 31),
                is_closed=False,
            )
        )

        return company


class CurrencyLookupAdapter:
    """Port implementation consumed by other modules (e.g. `sales`) to resolve
    a currency_uuid from a request DTO into the internal id, without importing
    core_org's repository/models directly."""

    def __init__(self, session: AsyncSession):
        self._repo = CurrencyRepository(session)

    async def get_currency_id_by_uuid(self, currency_uuid: UUID) -> int | None:
        currency = await self._repo.get_by_uuid(currency_uuid)
        return currency.id if currency is not None else None


class FiscalYearLookupAdapter:
    """Port implementation consumed by `accounting` to find the currently-open
    fiscal year for a company, without importing core_org's repository directly."""

    def __init__(self, session: AsyncSession):
        self._repo = FiscalYearRepository(session)

    async def get_open_fiscal_year_id(self, company_id: int) -> int | None:
        fy = await self._repo.get_open_for_company(company_id)
        return fy.id if fy is not None else None


class UomLookupAdapter:
    """Port implementation consumed by `inventory` to resolve a base_uom_uuid
    from ItemCreate into the internal id, without importing core_org directly."""

    def __init__(self, session: AsyncSession):
        self._repo = UnitOfMeasureRepository(session)

    async def get_uom_id_by_uuid(self, uom_uuid: UUID) -> int | None:
        uom = await self._repo.get_by_uuid(uom_uuid)
        return uom.id if uom is not None else None
