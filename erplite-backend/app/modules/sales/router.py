"""
app/modules/sales/router.py
HTTP layer only. Every endpoint: validate via Pydantic (automatic), call the
Service, translate DomainError -> HTTPException, return a Read DTO. No SQL,
no business rules here — see service.py / repository.py.

Every path uses `uuid` — never the internal `id` (ERP-003 Part 5 §1).
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user_id, get_db_with_context
from app.core.exceptions import BusinessRuleViolation, ConcurrencyConflict, NotFoundError
from app.core.security import TokenPayload
from app.core.dependencies import get_current_token
from app.modules.sales.repository import CustomerRepository, SalesOrderRepository
from app.modules.sales.schemas import (
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    SalesOrderCreate,
    SalesOrderRead,
    SalesOrderSummaryRead,
    SalesOrderSubmit,
)
from app.modules.sales.service import CustomerService, SalesOrderService

router = APIRouter(prefix="/sales", tags=["sales"])


def _company_id(token: TokenPayload) -> int:
    # ERP Lite: a user's token may list several accessible companies, but each
    # write operation targets exactly one — until a company-selector header/param
    # is added, the first company in scope is used. This is a deliberate, narrow
    # simplification documented here rather than left implicit.
    return token.company_ids[0]


def _domain_error_to_http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ConcurrencyConflict):
        return HTTPException(status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, BusinessRuleViolation):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected error")


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------


@router.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_db_with_context),
    token: TokenPayload = Depends(get_current_token),
    user_id: int = Depends(get_current_user_id),
):
    service = CustomerService(CustomerRepository(db))
    try:
        return await service.create(company_id=_company_id(token), created_by=user_id, data=payload)
    except BusinessRuleViolation as exc:
        raise _domain_error_to_http(exc) from exc


@router.get("/customers", response_model=list[CustomerRead])
async def list_customers(
    search: str | None = Query(default=None, description="Search by code or name (ILIKE)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    company_uuid: str | None = None,  # reserved for future explicit filter; unused for now
    db: AsyncSession = Depends(get_db_with_context),
):
    """List customers for the caller's company. Supports server-side pagination
    and search via ILIKE on customer_code + customer_name.

    Backward-compat: if `search` is omitted, returns the full list (limit 200)
    so existing callers see no behavior change."""
    repo = CustomerRepository(db)
    if search:
        rows, _ = await repo.search(
            search=search, limit=page_size, offset=(page - 1) * page_size
        )
    else:
        rows, _ = await repo.list(limit=200, offset=0)
    return rows


@router.get("/customers/{customer_uuid}", response_model=CustomerRead)
async def get_customer(
    customer_uuid: UUID,
    db: AsyncSession = Depends(get_db_with_context),
):
    service = CustomerService(CustomerRepository(db))
    try:
        return await service.get(customer_uuid)
    except NotFoundError as exc:
        raise _domain_error_to_http(exc) from exc


@router.patch("/customers/{customer_uuid}", response_model=CustomerRead)
async def update_customer(
    customer_uuid: UUID,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db_with_context),
    token: TokenPayload = Depends(get_current_token),
    user_id: int = Depends(get_current_user_id),
):
    service = CustomerService(CustomerRepository(db))
    try:
        return await service.update(customer_uuid, updated_by=user_id, data=payload)
    except (NotFoundError, ConcurrencyConflict) as exc:
        raise _domain_error_to_http(exc) from exc


# ---------------------------------------------------------------------------
# Sales Orders
# ---------------------------------------------------------------------------


@router.post("/sales-orders", response_model=SalesOrderRead, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    payload: SalesOrderCreate,
    db: AsyncSession = Depends(get_db_with_context),
    token: TokenPayload = Depends(get_current_token),
    user_id: int = Depends(get_current_user_id),
):
    from app.modules.inventory.service import ItemLookupAdapter
    from app.modules.core_org.service import CurrencyLookupAdapter

    service = SalesOrderService(
        SalesOrderRepository(db),
        CustomerRepository(db),
        item_lookup=ItemLookupAdapter(db),
        currency_lookup=CurrencyLookupAdapter(db),
    )
    try:
        return await service.create(
            company_id=_company_id(token), branch_id=None, created_by=user_id, data=payload
        )
    except BusinessRuleViolation as exc:
        raise _domain_error_to_http(exc) from exc


@router.get("/sales-orders", response_model=list[SalesOrderSummaryRead])
async def list_sales_orders(
    search: str | None = Query(default=None, description="Search by document number (ILIKE)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db_with_context),
):
    """Additive endpoint for the frontend's order list screen — lightweight
    (no lines/customer resolve) to avoid N+1 lookups on a list view.
    v1.0: server-side search on document_number + pagination."""
    repo = SalesOrderRepository(db)
    if search:
        from sqlalchemy import select as sa_select
        from app.modules.sales.models import SalesOrder as _SO
        pattern = f"%{search}%"
        stmt = (
            sa_select(_SO)
            .where(_SO.is_deleted.is_(False), _SO.document_number.ilike(pattern))
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        rows = list((await db.execute(stmt)).scalars().all())
    else:
        rows, _ = await repo.list(limit=200, offset=0)
    return rows


@router.get("/sales-orders/{order_uuid}", response_model=SalesOrderRead)
async def get_sales_order(
    order_uuid: UUID,
    db: AsyncSession = Depends(get_db_with_context),
):
    from app.modules.inventory.service import ItemLookupAdapter
    from app.modules.core_org.service import CurrencyLookupAdapter

    service = SalesOrderService(
        SalesOrderRepository(db), CustomerRepository(db), ItemLookupAdapter(db), CurrencyLookupAdapter(db)
    )
    try:
        return await service.get(order_uuid)
    except NotFoundError as exc:
        raise _domain_error_to_http(exc) from exc


@router.post("/sales-orders/{order_uuid}/submit", response_model=SalesOrderRead)
async def submit_sales_order(
    order_uuid: UUID,
    payload: SalesOrderSubmit,
    db: AsyncSession = Depends(get_db_with_context),
):
    from app.modules.inventory.service import ItemLookupAdapter
    from app.modules.core_org.service import CurrencyLookupAdapter

    service = SalesOrderService(
        SalesOrderRepository(db), CustomerRepository(db), ItemLookupAdapter(db), CurrencyLookupAdapter(db)
    )
    try:
        return await service.submit(order_uuid, expected_version_no=payload.expected_version_no)
    except (NotFoundError, ConcurrencyConflict, BusinessRuleViolation) as exc:
        raise _domain_error_to_http(exc) from exc
