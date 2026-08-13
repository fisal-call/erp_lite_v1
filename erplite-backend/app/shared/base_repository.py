"""
app/shared/base_repository.py
Generic Repository interface (Protocol) + a SQLAlchemy-backed base implementation
that every module's concrete repository extends. Repositories know SQL/SQLAlchemy;
they contain NO business logic (that belongs in service.py, per AD-004).
"""
from __future__ import annotations

from typing import Any, Generic, Protocol, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

ModelT = TypeVar("ModelT")


class Repository(Protocol[ModelT]):
    """Interface every concrete repository must satisfy. Kept as a Protocol
    (structural typing) rather than ABC so it stays lightweight and test-friendly
    (a fake in-memory repository can satisfy this Protocol without inheritance)."""

    async def get_by_uuid(self, entity_uuid: UUID) -> ModelT | None: ...
    async def list(self, *, limit: int, offset: int, **filters: Any) -> tuple[list[ModelT], int]: ...
    async def add(self, entity: ModelT) -> ModelT: ...
    async def flush(self) -> None: ...


class SqlAlchemyRepository(Generic[ModelT]):
    """
    Base implementation shared by every module's repository.py. Subclasses set
    `model` to their SQLAlchemy ORM class and may add entity-specific query
    methods (e.g. get_by_code) beyond this generic contract.

    IMPORTANT: the `session` passed in must always be one opened via
    `get_db_with_context` (see app/core/dependencies.py) for any company-scoped
    table — this class does not set RLS context itself, it assumes the caller
    already did (single responsibility: this class only knows SQL, not auth).
    """

    model: type[ModelT]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_uuid(self, entity_uuid: UUID) -> ModelT | None:
        stmt = select(self.model).where(self.model.uuid == entity_uuid, self.model.is_deleted.is_(False))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list(self, *, limit: int = 50, offset: int = 0, **filters: Any) -> tuple[list[ModelT], int]:
        stmt = select(self.model).where(self.model.is_deleted.is_(False))
        count_stmt = select(func.count()).select_from(self.model).where(self.model.is_deleted.is_(False))
        for field, value in filters.items():
            if value is None:
                continue
            column = getattr(self.model, field)
            stmt = stmt.where(column == value)
            count_stmt = count_stmt.where(column == value)

        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = stmt.limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), total

    async def add(self, entity: ModelT) -> ModelT:
        self.session.add(entity)
        await self.session.flush()  # populate identity/uuid defaults without committing yet
        return entity

    async def flush(self) -> None:
        await self.session.flush()
