"""
app/modules/security/repository.py
"""
from __future__ import annotations

from sqlalchemy import delete, select

from app.modules.security.models import AppUser, UserCompanyAccess
from app.shared.base_repository import SqlAlchemyRepository


class AppUserRepository(SqlAlchemyRepository[AppUser]):
    model = AppUser

    async def get_by_username(self, username: str) -> AppUser | None:
        stmt = select(AppUser).where(AppUser.username == username, AppUser.is_deleted.is_(False))
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_by_email(self, email: str) -> AppUser | None:
        stmt = select(AppUser).where(AppUser.email == email, AppUser.is_deleted.is_(False))
        return (await self.session.execute(stmt)).scalar_one_or_none()


class UserCompanyAccessRepository(SqlAlchemyRepository[UserCompanyAccess]):
    model = UserCompanyAccess

    async def list_company_ids(self, user_id: int) -> list[int]:
        stmt = select(UserCompanyAccess.company_id).where(UserCompanyAccess.user_id == user_id)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(dict.fromkeys(rows))  # de-duplicate, preserve order

    async def grant(self, user_id: int, company_id: int) -> UserCompanyAccess:
        return await self.add(UserCompanyAccess(user_id=user_id, company_id=company_id))

    async def revoke_all_for_user(self, user_id: int) -> int:
        """Delete all company-access rows for a user. Returns the number of
        rows deleted (not currently surfaced to the caller, but kept for
        potential audit logging)."""
        stmt = delete(UserCompanyAccess).where(UserCompanyAccess.user_id == user_id)
        result = await self.session.execute(stmt)
        return int(result.rowcount or 0)
