"""
app/modules/cost_centers/service.py
Business logic for cost centers. Same pattern as CustomerService:
uniqueness pre-check, optimistic locking, UUID→ID resolution for parent.
"""
from __future__ import annotations

from uuid import UUID

from app.core.exceptions import BusinessRuleViolation, ConcurrencyConflict, NotFoundError
from app.modules.cost_centers.models import CostCenter
from app.modules.cost_centers.repository import CostCenterRepository
from app.modules.cost_centers.schemas import CostCenterCreate, CostCenterRead, CostCenterUpdate


class CostCenterService:
    def __init__(self, repo: CostCenterRepository):
        self.repo = repo

    async def create(self, *, company_id: int, created_by: int, data: CostCenterCreate) -> CostCenter:
        # Pre-check uniqueness — DB constraint uq_cost_center__company_code would
        # also catch this, but we want a clean 409/422 instead of IntegrityError.
        existing = await self.repo.get_by_code(company_id, data.cost_center_code)
        if existing is not None:
            raise BusinessRuleViolation(
                "CC-DUP", f"Cost center code '{data.cost_center_code}' already exists for this company."
            )

        parent_id: int | None = None
        if data.parent_cost_center_uuid is not None:
            parent = await self.repo.get_by_uuid(data.parent_cost_center_uuid)
            if parent is None or parent.company_id != company_id:
                raise BusinessRuleViolation(
                    "CC-PARENT", f"Unknown parent cost center {data.parent_cost_center_uuid}."
                )
            parent_id = parent.id

        cc = CostCenter(
            company_id=company_id,
            cost_center_code=data.cost_center_code,
            cost_center_name=data.cost_center_name,
            parent_cost_center_id=parent_id,
            created_by=created_by,
            updated_by=created_by,
        )
        return await self.repo.add(cc)

    async def list(self, *, company_id: int) -> list[CostCenter]:
        items, _total = await self.repo.list(limit=1000, offset=0, company_id=company_id)
        return items

    async def get(self, cost_center_uuid: UUID) -> CostCenter:
        cc = await self.repo.get_by_uuid(cost_center_uuid)
        if cc is None:
            raise NotFoundError("CostCenter", str(cost_center_uuid))
        return cc

    async def update(self, cost_center_uuid: UUID, *, updated_by: int, data: CostCenterUpdate) -> CostCenter:
        cc = await self.get(cost_center_uuid)

        # PDR-001 Optimistic Locking
        if cc.version_no != data.expected_version_no:
            raise ConcurrencyConflict("CostCenter", str(cost_center_uuid))

        for field in ("cost_center_name", "is_active"):
            value = getattr(data, field)
            if value is not None:
                setattr(cc, field, value)
        cc.version_no += 1
        cc.updated_by = updated_by
        await self.repo.flush()
        return cc

    async def to_read_dto(self, cc: CostCenter) -> CostCenterRead:
        parent_uuid: UUID | None = None
        if cc.parent_cost_center_id is not None:
            # Resolve parent uuid via a fresh SELECT (not session.get, which
            # can fail after commit() inside the request's context manager).
            from sqlalchemy import select as sa_select
            stmt = sa_select(CostCenter.uuid).where(CostCenter.id == cc.parent_cost_center_id)
            row = (await self.repo.session.execute(stmt)).scalar_one_or_none()
            if row is not None:
                parent_uuid = row
        return CostCenterRead(
            uuid=cc.uuid,
            cost_center_code=cc.cost_center_code,
            cost_center_name=cc.cost_center_name,
            parent_cost_center_uuid=parent_uuid,
            is_active=cc.is_active,
            created_at=cc.created_at,
            updated_at=cc.updated_at,
            version_no=cc.version_no,
        )
