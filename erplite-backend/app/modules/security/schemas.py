"""
app/modules/security/schemas.py
"""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.shared.schemas import ORMBase


class UserCreate(BaseModel):
    username: str = Field(max_length=100)
    email: EmailStr
    full_name: str = Field(max_length=200)
    password: str = Field(min_length=8)
    # Every new user must be granted access to at least one company at creation
    # time — a user with zero company_ids can never pass RlsContext validation
    # (app/core/database.py) and would be permanently locked out otherwise.
    company_ids: list[int] = Field(min_length=1)


class UserPatch(BaseModel):
    """Partial update. All fields optional. expected_version_no is REQUIRED for
    optimistic locking — mirrors Customer/Patch schema pattern."""
    full_name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)
    company_ids: list[int] | None = Field(default=None, min_length=1)
    expected_version_no: int = Field(..., description="Current version_no of the row — 409 on mismatch")


class UserRead(ORMBase):
    uuid: UUID
    username: str
    email: str
    full_name: str
    is_active: bool


class UserSummaryRead(BaseModel):
    """Slimmer than UserRead for list views. Carries just enough to identify
    a user in a table — omit email to avoid leaking PII through a list
    endpoint that any authenticated user can hit (until RBAC). version_no is
    included so callers can do optimistic-lock PATCHes without an extra GET."""
    uuid: UUID
    username: str
    full_name: str
    is_active: bool
    version_no: int


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
