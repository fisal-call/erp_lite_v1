"""
app/modules/purchasing/repository.py
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.modules.purchasing.models import PurchaseOrder, Supplier
from app.shared.base_repository import SqlAlchemyRepository


class SupplierRepository(SqlAlchemyRepository[Supplier]):
    model = Supplier

    async def get_by_code(self, company_id: int, supplier_code: str) -> Supplier | None:
        stmt = select(Supplier).where(
            Supplier.company_id == company_id,
            Supplier.supplier_code == supplier_code,
            Supplier.is_deleted.is_(False),
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def search(
        self, *, search: str, limit: int, offset: int
    ) -> tuple[list[Supplier], int]:
        """ILIKE search on supplier_code + supplier_name — additive, no schema change.
        Company scoping is handled by RLS."""
        pattern = f"%{search}%"
        stmt = (
            select(Supplier)
            .where(
                Supplier.is_deleted.is_(False),
                (Supplier.supplier_name.ilike(pattern) | Supplier.supplier_code.ilike(pattern)),
            )
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), len(rows)


class PurchaseOrderRepository(SqlAlchemyRepository[PurchaseOrder]):
    model = PurchaseOrder

    async def get_by_uuid_with_lines(self, order_uuid: UUID) -> PurchaseOrder | None:
        stmt = (
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.lines), selectinload(PurchaseOrder.supplier))
            .where(PurchaseOrder.uuid == order_uuid, PurchaseOrder.is_deleted.is_(False))
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()
