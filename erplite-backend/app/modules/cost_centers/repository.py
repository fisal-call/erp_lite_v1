"""
app/modules/cost_centers/repository.py
"""
from __future__ import annotations

from sqlalchemy import select

from app.modules.cost_centers.models import CostCenter
from app.shared.base_repository import SqlAlchemyRepository


class CostCenterRepository(SqlAlchemyRepository[CostCenter]):
    model = CostCenter

    async def get_by_code(self, company_id: int, cost_center_code: str) -> CostCenter | None:
        stmt = select(CostCenter).where(
            CostCenter.company_id == company_id,
            CostCenter.cost_center_code == cost_center_code,
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()
