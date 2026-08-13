"""
app/modules/inventory/router.py
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_token, get_db_with_context
from app.core.exceptions import BusinessRuleViolation, ConcurrencyConflict, NotFoundError
from app.core.security import TokenPayload
from app.modules.inventory.repository import ItemCategoryRepository, ItemRepository, WarehouseRepository
from app.modules.inventory.schemas import (
    ItemCategoryCreate,
    ItemCategoryRead,
    ItemCreate,
    ItemRead,
    ItemUpdate,
    StockBalanceRead,
    WarehouseCreate,
    WarehouseRead,
)
from app.modules.inventory.service import (
    ItemCategoryService,
    ItemService,
    StockBalanceService,
    WarehouseService,
)
from app.shared.schemas import Page, PageParams

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _company_id(token: TokenPayload) -> int:
    return token.company_ids[0]


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ConcurrencyConflict):
        return HTTPException(status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, BusinessRuleViolation):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected error")


@router.post("/item-categories", response_model=ItemCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_item_category(
    payload: ItemCategoryCreate,
    token: TokenPayload = Depends(get_current_token),
    db: AsyncSession = Depends(get_db_with_context),
):
    service = ItemCategoryService(ItemCategoryRepository(db))
    return await service.create(company_id=_company_id(token), data=payload)


@router.get("/item-categories", response_model=list[ItemCategoryRead])
async def list_item_categories(db: AsyncSession = Depends(get_db_with_context)):
    repo = ItemCategoryRepository(db)
    rows, _ = await repo.list(limit=200, offset=0)
    return rows


@router.post("/items", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    token: TokenPayload = Depends(get_current_token),
    db: AsyncSession = Depends(get_db_with_context),
):
    from app.modules.core_org.service import UomLookupAdapter

    service = ItemService(ItemRepository(db), ItemCategoryRepository(db), UomLookupAdapter(db))
    try:
        return await service.create(company_id=_company_id(token), data=payload)
    except BusinessRuleViolation as exc:
        raise _http(exc) from exc


@router.get("/items/{item_uuid}", response_model=ItemRead)
async def get_item(item_uuid: UUID, db: AsyncSession = Depends(get_db_with_context)):
    service = ItemService(ItemRepository(db), ItemCategoryRepository(db))
    try:
        return await service.get(item_uuid)
    except NotFoundError as exc:
        raise _http(exc) from exc


@router.patch("/items/{item_uuid}", response_model=ItemRead)
async def update_item(
    item_uuid: UUID,
    payload: ItemUpdate,
    db: AsyncSession = Depends(get_db_with_context),
):
    """Partial update of an item. Mirrors PATCH /sales/customers/{uuid}.
    item_code, item_category_uuid, base_uom_uuid are NOT editable — see ItemUpdate."""
    service = ItemService(ItemRepository(db), ItemCategoryRepository(db))
    try:
        item = await service.update(item_uuid, payload)
        await db.commit()
    except (NotFoundError, ConcurrencyConflict, BusinessRuleViolation) as exc:
        await db.rollback()
        raise _http(exc) from exc
    return item


@router.get("/items", response_model=Page[ItemRead])
async def list_items(
    page_params: PageParams = Depends(),
    search: str | None = None,
    token: TokenPayload = Depends(get_current_token),
    db: AsyncSession = Depends(get_db_with_context),
):
    service = ItemService(ItemRepository(db), ItemCategoryRepository(db))
    items, total = await service.list(
        company_id=_company_id(token), limit=page_params.page_size, offset=page_params.offset, search=search
    )
    return Page(items=items, total=total, page=page_params.page, page_size=page_params.page_size)


@router.post("/warehouses", response_model=WarehouseRead, status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    payload: WarehouseCreate,
    token: TokenPayload = Depends(get_current_token),
    db: AsyncSession = Depends(get_db_with_context),
):
    service = WarehouseService(WarehouseRepository(db))
    return await service.create(company_id=_company_id(token), data=payload)


@router.get("/warehouses", response_model=list[WarehouseRead])
async def list_warehouses(db: AsyncSession = Depends(get_db_with_context)):
    repo = WarehouseRepository(db)
    rows, _ = await repo.list(limit=200, offset=0)
    return rows


@router.get("/stock-balance", response_model=list[StockBalanceRead])
async def get_stock_balance(
    token: TokenPayload = Depends(get_current_token),
    db: AsyncSession = Depends(get_db_with_context),
):
    service = StockBalanceService(db)
    return await service.list_balance(_company_id(token))
