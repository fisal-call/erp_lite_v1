"""
app/modules/core_org/repository.py
"""
from __future__ import annotations

from sqlalchemy import select

from app.modules.core_org.models import Branch, Company, Country, Currency, FiscalYear, UnitOfMeasure
from app.shared.base_repository import SqlAlchemyRepository


class CompanyRepository(SqlAlchemyRepository[Company]):
    model = Company


class BranchRepository(SqlAlchemyRepository[Branch]):
    model = Branch


class FiscalYearRepository(SqlAlchemyRepository[FiscalYear]):
    model = FiscalYear

    async def get_open_for_company(self, company_id: int) -> FiscalYear | None:
        stmt = select(FiscalYear).where(FiscalYear.company_id == company_id, FiscalYear.is_closed.is_(False))
        return (await self.session.execute(stmt)).scalars().first()


class CurrencyRepository(SqlAlchemyRepository[Currency]):
    model = Currency

    async def list_active(self) -> list[Currency]:
        stmt = select(Currency).where(Currency.is_active.is_(True))
        return list((await self.session.execute(stmt)).scalars().all())


class CountryRepository(SqlAlchemyRepository[Country]):
    model = Country


class UnitOfMeasureRepository(SqlAlchemyRepository[UnitOfMeasure]):
    model = UnitOfMeasure

    async def list_active(self) -> list[UnitOfMeasure]:
        stmt = select(UnitOfMeasure).where(UnitOfMeasure.is_active.is_(True))
        return list((await self.session.execute(stmt)).scalars().all())
