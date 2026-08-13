"""
app/shared/schemas.py
Common Pydantic building blocks reused by every module's schemas.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMBase(BaseModel):
    """Base for any Read DTO backed by an ORM row. Never include the internal
    BIGINT `id` here — uuid only, per ERP-003 Part 5 §1 (API Identity Strategy)."""

    model_config = ConfigDict(from_attributes=True)


class AuditFieldsRead(BaseModel):
    """Standard audit columns (ERP-004 §5), exposed read-only on every Read DTO."""

    created_at: datetime
    updated_at: datetime | None = None
    version_no: int


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class UuidRef(BaseModel):
    """Generic wrapper for referencing another entity by uuid only in request bodies,
    e.g. {"customer_uuid": "..."} — never a raw internal id."""

    uuid: UUID
