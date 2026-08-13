"""
app/modules/security/service.py
"""
from __future__ import annotations

from uuid import UUID

from app.core.exceptions import BusinessRuleViolation, ConcurrencyConflict, NotFoundError
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.security.models import AppUser
from app.modules.security.repository import AppUserRepository, UserCompanyAccessRepository
from app.modules.security.schemas import UserCreate, UserPatch


class UserService:
    def __init__(self, user_repo: AppUserRepository, access_repo: UserCompanyAccessRepository):
        self.user_repo = user_repo
        self.access_repo = access_repo

    async def create(self, data: UserCreate) -> AppUser:
        # BD-010: username/email are permanently reserved even for soft-deleted rows —
        # pre-check here for a clean 422 instead of a raw IntegrityError.
        if await self.user_repo.get_by_username(data.username) is not None:
            raise BusinessRuleViolation("BD-010", f"Username '{data.username}' is already taken.")
        if await self.user_repo.get_by_email(data.email) is not None:
            raise BusinessRuleViolation("BD-010", f"Email '{data.email}' is already taken.")

        user = AppUser(
            username=data.username,
            email=data.email,
            full_name=data.full_name,
            password_hash=hash_password(data.password),
        )
        await self.user_repo.add(user)

        for company_id in data.company_ids:
            await self.access_repo.grant(user.id, company_id)
        await self.access_repo.flush()
        return user

    async def update(self, user_uuid: UUID, patch: UserPatch) -> AppUser:
        """Partial update with optimistic locking. See UserPatch for field semantics."""
        user = await self.user_repo.get_by_uuid(user_uuid)
        if user is None:
            raise NotFoundError("AppUser", str(user_uuid))

        # Optimistic lock check
        if user.version_no != patch.expected_version_no:
            raise ConcurrencyConflict("AppUser", str(user_uuid))

        # Email uniqueness (if changing)
        if patch.email is not None and patch.email != user.email:
            existing = await self.user_repo.get_by_email(patch.email)
            if existing is not None and existing.id != user.id:
                raise BusinessRuleViolation("BD-010", f"Email '{patch.email}' is already taken.")
            user.email = patch.email

        # Simple scalar fields
        if patch.full_name is not None:
            user.full_name = patch.full_name
        if patch.is_active is not None:
            user.is_active = patch.is_active

        # Password rotation (only if a new password is supplied)
        if patch.password is not None:
            user.password_hash = hash_password(patch.password)

        # Company access replacement (only if a new list is supplied)
        if patch.company_ids is not None:
            await self.access_repo.revoke_all_for_user(user.id)
            for company_id in patch.company_ids:
                await self.access_repo.grant(user.id, company_id)
            await self.access_repo.flush()

        user.version_no += 1
        await self.user_repo.flush()
        return user

    async def get_internal_id_by_uuid(self, user_uuid) -> int:
        user = await self.user_repo.get_by_uuid(user_uuid)
        if user is None:
            raise NotFoundError("AppUser", str(user_uuid))
        return user.id


class AuthService:
    def __init__(self, user_repo: AppUserRepository, access_repo: UserCompanyAccessRepository):
        self.user_repo = user_repo
        self.access_repo = access_repo

    async def login(self, *, username: str, password: str) -> str:
        user = await self.user_repo.get_by_username(username)
        if user is None or not verify_password(password, user.password_hash):
            # Deliberately identical error for "no such user" and "wrong password" —
            # distinguishing them is a username-enumeration side channel.
            raise BusinessRuleViolation("AUTH-001", "Invalid username or password.")
        if not user.is_active:
            raise BusinessRuleViolation("AUTH-002", "This account is deactivated.")

        company_ids = await self.access_repo.list_company_ids(user.id)
        if not company_ids:
            # Matches the RlsContext invariant in app/core/database.py: a token with
            # zero company_ids cannot be issued — fail here with a clear message
            # instead of letting it surface as a confusing later error.
            raise BusinessRuleViolation("AUTH-003", "This account has no company access granted.")

        return create_access_token(user_uuid=str(user.uuid), company_ids=company_ids, tenant_id=1)
