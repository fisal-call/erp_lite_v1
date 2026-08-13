"""
app/modules/cost_centers/router.py
CRUD endpoints for cost centers — list, create, get, patch.
All endpoints require JWT auth + RLS context (company-scoped).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_token, get_current_user_id, get_db_with_context
from app.core.exceptions import BusinessRuleViolation, NotFoundError, ConcurrencyConflict
from app.core.security import TokenPayload
from app.modules.cost_centers.repository import CostCenterRepository
from app.modules.cost_centers.schemas import CostCenterCreate, CostCenterRead, CostCenterUpdate
from app.modules.cost_centers.service import CostCenterService

router = APIRouter(prefix="/cost-centers", tags=["cost-centers"])


def _company_id(token: TokenPayload) -> int:
    if not token.company_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token has no company scope.",
        )
    return token.company_ids[0]


@router.get("", response_model=list[CostCenterRead])
async def list_cost_centers(
    token: TokenPayload = Depends(get_current_token),
    db: AsyncSession = Depends(get_db_with_context),
):
    cid = _company_id(token)
    repo = CostCenterRepository(db)
    service = CostCenterService(repo)
    items = await service.list(company_id=cid)
    return [await service.to_read_dto(c) for c in items]


@router.post("", response_model=CostCenterRead, status_code=status.HTTP_201_CREATED)
async def create_cost_center(
    payload: CostCenterCreate,
    token: TokenPayload = Depends(get_current_token),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_with_context),
):
    cid = _company_id(token)
    service = CostCenterService(CostCenterRepository(db))
    try:
        cc = await service.create(company_id=cid, created_by=user_id, data=payload)
        # Build DTO BEFORE commit — once committed, the session's transaction
        # is closed and any further queries (e.g. parent uuid lookup) will fail.
        dto = await service.to_read_dto(cc)
        await db.commit()
    except BusinessRuleViolation as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return dto


@router.get("/{cost_center_uuid}", response_model=CostCenterRead)
async def get_cost_center(
    cost_center_uuid: str,
    db: AsyncSession = Depends(get_db_with_context),
):
    service = CostCenterService(CostCenterRepository(db))
    try:
        cc = await service.get(cost_center_uuid)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return await service.to_read_dto(cc)


@router.patch("/{cost_center_uuid}", response_model=CostCenterRead)
async def update_cost_center(
    cost_center_uuid: str,
    payload: CostCenterUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_with_context),
):
    service = CostCenterService(CostCenterRepository(db))
    try:
        cc = await service.update(cost_center_uuid, updated_by=user_id, data=payload)
        dto = await service.to_read_dto(cc)
        await db.commit()
    except NotFoundError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConcurrencyConflict as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except BusinessRuleViolation as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return dto
