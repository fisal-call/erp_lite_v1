"""
app/modules/purchasing/router.py
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_token, get_current_user_id, get_db_with_context
from app.core.exceptions import BusinessRuleViolation, ConcurrencyConflict, NotFoundError
from app.core.security import TokenPayload
from app.modules.purchasing.repository import PurchaseOrderRepository, SupplierRepository
from app.modules.purchasing.schemas import (
    PurchaseOrderCreate,
    PurchaseOrderRead,
    PurchaseOrderSubmit,
    PurchaseOrderSummaryRead,
    SupplierCreate,
    SupplierRead,
    SupplierUpdate,
)
from app.modules.purchasing.service import PurchaseOrderService, SupplierService

router = APIRouter(prefix="/purchasing", tags=["purchasing"])


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


async def _po_service(db: AsyncSession = Depends(get_db_with_context)) -> PurchaseOrderService:
    from app.modules.core_org.service import CurrencyLookupAdapter
    from app.modules.inventory.service import ItemLookupAdapter

    return PurchaseOrderService(
        PurchaseOrderRepository(db), SupplierRepository(db), ItemLookupAdapter(db), CurrencyLookupAdapter(db)
    )


@router.post("/suppliers", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: SupplierCreate,
    token: TokenPayload = Depends(get_current_token),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_with_context),
):
    service = SupplierService(SupplierRepository(db))
    try:
        return await service.create(company_id=_company_id(token), created_by=user_id, data=payload)
    except BusinessRuleViolation as exc:
        raise _http(exc) from exc


@router.get("/suppliers", response_model=list[SupplierRead])
async def list_suppliers(
    search: str | None = Query(default=None, description="Search by code or name (ILIKE)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db_with_context),
):
    """List suppliers for the caller's company. Server-side pagination + search.
    Backward-compat: omitted `search` returns the full list (limit 200)."""
    repo = SupplierRepository(db)
    if search:
        rows, _ = await repo.search(
            search=search, limit=page_size, offset=(page - 1) * page_size
        )
    else:
        rows, _ = await repo.list(limit=200, offset=0)
    return rows


@router.get("/suppliers/{supplier_uuid}", response_model=SupplierRead)
async def get_supplier(supplier_uuid: UUID, db: AsyncSession = Depends(get_db_with_context)):
    service = SupplierService(SupplierRepository(db))
    try:
        return await service.get(supplier_uuid)
    except NotFoundError as exc:
        raise _http(exc) from exc


@router.patch("/suppliers/{supplier_uuid}", response_model=SupplierRead)
async def update_supplier(
    supplier_uuid: UUID,
    payload: SupplierUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_with_context),
):
    """Partial update of a supplier. Mirrors PATCH /sales/customers/{uuid} exactly.
    supplier_code is NOT editable — it's a stable external identifier."""
    service = SupplierService(SupplierRepository(db))
    try:
        supplier = await service.update(supplier_uuid, updated_by=user_id, data=payload)
        await db.commit()
    except (NotFoundError, ConcurrencyConflict, BusinessRuleViolation) as exc:
        await db.rollback()
        raise _http(exc) from exc
    return supplier


@router.post("/purchase-orders", response_model=PurchaseOrderRead, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: PurchaseOrderCreate,
    token: TokenPayload = Depends(get_current_token),
    user_id: int = Depends(get_current_user_id),
    service: PurchaseOrderService = Depends(_po_service),
):
    try:
        return await service.create(
            company_id=_company_id(token), branch_id=None, created_by=user_id, data=payload
        )
    except BusinessRuleViolation as exc:
        raise _http(exc) from exc


@router.get("/purchase-orders", response_model=list[PurchaseOrderSummaryRead])
async def list_purchase_orders(
    search: str | None = Query(default=None, description="Search by document number (ILIKE)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db_with_context),
):
    """v1.0: server-side search on document_number + pagination."""
    repo = PurchaseOrderRepository(db)
    if search:
        from sqlalchemy import select as sa_select
        from app.modules.purchasing.models import PurchaseOrder as _PO
        pattern = f"%{search}%"
        stmt = (
            sa_select(_PO)
            .where(_PO.is_deleted.is_(False), _PO.document_number.ilike(pattern))
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        rows = list((await db.execute(stmt)).scalars().all())
    else:
        rows, _ = await repo.list(limit=200, offset=0)
    return rows


@router.get("/purchase-orders/{order_uuid}", response_model=PurchaseOrderRead)
async def get_purchase_order(order_uuid: UUID, service: PurchaseOrderService = Depends(_po_service)):
    try:
        return await service.get(order_uuid)
    except NotFoundError as exc:
        raise _http(exc) from exc


@router.post("/purchase-orders/{order_uuid}/submit", response_model=PurchaseOrderRead)
async def submit_purchase_order(
    order_uuid: UUID,
    payload: PurchaseOrderSubmit,
    service: PurchaseOrderService = Depends(_po_service),
):
    try:
        return await service.submit(order_uuid, expected_version_no=payload.expected_version_no)
    except (NotFoundError, ConcurrencyConflict, BusinessRuleViolation) as exc:
        raise _http(exc) from exc
