"""
app/modules/inventory/repository.py
"""
from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.inventory.models import Item, ItemCategory, Warehouse
from app.shared.base_repository import SqlAlchemyRepository


class ItemCategoryRepository(SqlAlchemyRepository[ItemCategory]):
    model = ItemCategory


class ItemRepository(SqlAlchemyRepository[Item]):
    model = Item

    async def get_by_code(self, company_id: int, item_code: str) -> Item | None:
        stmt = select(Item).where(
            Item.company_id == company_id, Item.item_code == item_code, Item.is_deleted.is_(False)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def search(self, *, company_id: int, search: str, limit: int, offset: int) -> tuple[list[Item], int]:
        """Uses the trigram index (ix_item__name_search, ERP-Lite-002) via ILIKE —
        additive read-only query, no schema/index change needed."""
        stmt = (
            select(Item)
            .where(
                Item.company_id == company_id,
                Item.is_deleted.is_(False),
                (Item.item_name.ilike(f"%{search}%") | Item.item_code.ilike(f"%{search}%")),
            )
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), len(rows)


class WarehouseRepository(SqlAlchemyRepository[Warehouse]):
    model = Warehouse


async def get_stock_balance(session: AsyncSession, company_id: int) -> list[dict]:
    """Reads reporting.v_stock_balance (Phase 2 view) — RLS on the underlying
    stock_ledger_entry/item/warehouse tables applies transparently since this
    view is invoker-rights (no SECURITY DEFINER)."""
    rows = await session.execute(
        text(
            "SELECT item_code, item_name, warehouse_name, qty_on_hand "
            "FROM reporting.v_stock_balance WHERE company_id = :company_id"
        ),
        {"company_id": company_id},
    )
    return [dict(r._mapping) for r in rows]
