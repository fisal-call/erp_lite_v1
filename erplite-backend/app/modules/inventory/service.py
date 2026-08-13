"""
app/modules/inventory/service.py
Exposes ItemLookupAdapter (the ItemLookupPort implementation consumed by `sales`
and `purchasing`) plus full CRUD services for Item/ItemCategory/Warehouse.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleViolation, ConcurrencyConflict, NotFoundError
from app.modules.inventory.models import Item, ItemCategory, Warehouse
from app.modules.inventory.repository import (
    ItemCategoryRepository,
    ItemRepository,
    WarehouseRepository,
    get_stock_balance,
)
from app.modules.inventory.schemas import ItemCategoryCreate, ItemCreate, ItemUpdate, WarehouseCreate


class ItemCategoryService:
    def __init__(self, repo: ItemCategoryRepository):
        self.repo = repo

    async def create(self, *, company_id: int, data: ItemCategoryCreate) -> ItemCategory:
        return await self.repo.add(ItemCategory(company_id=company_id, category_name=data.category_name))


class ItemService:
    def __init__(self, repo: ItemRepository, category_repo: ItemCategoryRepository, uom_lookup=None):
        self.repo = repo
        self.category_repo = category_repo
        self.uom_lookup = uom_lookup

    async def create(self, *, company_id: int, data: ItemCreate) -> Item:
        if await self.repo.get_by_code(company_id, data.item_code) is not None:
            # BD-010: item_code is permanently reserved after soft delete too —
            # this check catches both "active duplicate" and "code reused after delete".
            raise BusinessRuleViolation("BD-010", f"Item code '{data.item_code}' already exists.")

        category = await self.category_repo.get_by_uuid(data.item_category_uuid)
        if category is None or category.company_id != company_id:
            raise BusinessRuleViolation("INV-001", "Unknown item category.")

        uom_id = None
        if self.uom_lookup is not None:
            uom_id = await self.uom_lookup.get_uom_id_by_uuid(data.base_uom_uuid)
        if uom_id is None:
            raise BusinessRuleViolation("INV-002", "Unknown unit of measure.")

        item = Item(
            company_id=company_id,
            item_code=data.item_code,
            item_name=data.item_name,
            item_category_id=category.id,
            base_uom_id=uom_id,
            custom_fields=data.custom_fields,
        )
        return await self.repo.add(item)

    async def get(self, item_uuid: UUID) -> Item:
        item = await self.repo.get_by_uuid(item_uuid)
        if item is None:
            raise NotFoundError("Item", str(item_uuid))
        return item

    async def update(self, item_uuid: UUID, data: ItemUpdate) -> Item:
        item = await self.get(item_uuid)

        # PDR-001 Optimistic Locking
        if item.version_no != data.expected_version_no:
            raise ConcurrencyConflict("Item", str(item_uuid))

        for field in ("item_name", "is_active", "custom_fields"):
            value = getattr(data, field)
            if value is not None:
                setattr(item, field, value)
        item.version_no += 1
        await self.repo.flush()
        return item

    async def list(self, *, company_id: int, limit: int, offset: int, search: str | None = None) -> tuple[list[Item], int]:
        if search:
            return await self.repo.search(company_id=company_id, search=search, limit=limit, offset=offset)
        return await self.repo.list(limit=limit, offset=offset, company_id=company_id)


class WarehouseService:
    def __init__(self, repo: WarehouseRepository):
        self.repo = repo

    async def create(self, *, company_id: int, data: WarehouseCreate) -> Warehouse:
        # NOTE: branch_uuid resolution deferred (needs core_org BranchRepository port,
        # same pattern as currency) — branch_id left NULL (central-warehouse semantics,
        # valid per the composite FK design in ERP-Lite-002) until wired.
        return await self.repo.add(
            Warehouse(
                company_id=company_id,
                warehouse_name=data.warehouse_name,
                allow_negative_stock=data.allow_negative_stock,
            )
        )


class StockBalanceService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_balance(self, company_id: int) -> list[dict]:
        return await get_stock_balance(self.session, company_id)


class ItemLookupAdapter:
    def __init__(self, session: AsyncSession):
        self._repo = ItemRepository(session)

    async def get_item_id_by_uuid(self, company_id: int, item_uuid: UUID) -> int | None:
        item = await self._repo.get_by_uuid(item_uuid)
        if item is None or item.company_id != company_id:
            return None
        return item.id

    async def get_item_uuid_by_id(self, item_id: int) -> UUID | None:
        item = await self._repo.session.get(self._repo.model, item_id)
        return item.uuid if item is not None else None
