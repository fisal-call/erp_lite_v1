"""
app/modules/sales/repository.py
SQLAlchemy-only persistence for the sales module. No business rules here — see service.py.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.modules.sales.models import Customer, SalesOrder
from app.shared.base_repository import SqlAlchemyRepository


class CustomerRepository(SqlAlchemyRepository[Customer]):
    model = Customer

    async def get_by_code(self, company_id: int, customer_code: str) -> Customer | None:
        stmt = select(Customer).where(
            Customer.company_id == company_id,
            Customer.customer_code == customer_code,
            Customer.is_deleted.is_(False),
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def search(
        self, *, search: str, limit: int, offset: int
    ) -> tuple[list[Customer], int]:
        """ILIKE search on customer_code + customer_name — additive, no schema change.
        Company scoping is handled by RLS (the session already has
        app.current_company_ids set), so no explicit company_id filter here."""
        pattern = f"%{search}%"
        stmt = (
            select(Customer)
            .where(
                Customer.is_deleted.is_(False),
                (Customer.customer_name.ilike(pattern) | Customer.customer_code.ilike(pattern)),
            )
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), len(rows)


class SalesOrderRepository(SqlAlchemyRepository[SalesOrder]):
    model = SalesOrder

    async def get_by_uuid_with_lines(self, order_uuid: UUID) -> SalesOrder | None:
        stmt = (
            select(SalesOrder)
            .options(selectinload(SalesOrder.lines), selectinload(SalesOrder.customer))
            .where(SalesOrder.uuid == order_uuid, SalesOrder.is_deleted.is_(False))
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()
