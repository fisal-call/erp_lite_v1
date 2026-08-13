"""
app/modules/core_org/schemas.py
"""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.shared.schemas import ORMBase


class CompanyCreate(BaseModel):
    """Bootstrap Company flow (ERP-004 §15.7): creates the company AND its first
    branch in one call — a company with zero branches is not independently useful."""

    company_name: str = Field(max_length=200)
    base_currency_uuid: UUID
    country_uuid: UUID
    first_branch_name: str = Field(max_length=200, default="Main Branch")


class CompanyRead(ORMBase):
    uuid: UUID
    company_name: str
    timezone: str
    inventory_valuation_method: str
    is_active: bool


class BranchRead(ORMBase):
    uuid: UUID
    branch_name: str
    is_active: bool


class CurrencyRead(ORMBase):
    uuid: UUID
    iso_code: str
    name_ar: str
    name_en: str
    symbol: str | None


class CountryRead(ORMBase):
    uuid: UUID
    iso_code: str
    name_ar: str
    name_en: str


class UnitOfMeasureRead(ORMBase):
    uuid: UUID
    uom_name: str
