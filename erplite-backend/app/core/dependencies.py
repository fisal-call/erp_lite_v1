"""
app/core/dependencies.py
FastAPI dependencies shared across every module's router.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import RlsContext, db_session_with_context, get_db, get_db_bootstrap
from app.core.security import TokenPayload, decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/security/auth/login")


def get_current_token(token: str = Depends(oauth2_scheme)) -> TokenPayload:
    try:
        return decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_db_with_context(
    token: TokenPayload = Depends(get_current_token),
) -> AsyncGenerator[AsyncSession, None]:
    """
    THE standard dependency for every business endpoint in this backend.
    Resolves the JWT into an RlsContext and opens a DB session with RLS session
    variables already set (see app/core/database.py for the full contract).

    Usage in a router:
        @router.get("/customers/{customer_uuid}")
        async def get_customer(
            customer_uuid: UUID,
            db: AsyncSession = Depends(get_db_with_context),
        ):
            ...
    """
    ctx = RlsContext(company_ids=token.company_ids, tenant_id=token.tenant_id)
    async with db_session_with_context(ctx) as session:
        yield session


def require_company_in_scope(company_uuid_param_name: str = "company_uuid"):
    """
    Optional extra guard for endpoints that accept an explicit company_uuid path/query
    parameter (rather than always operating on "all companies in token"), to fail fast
    with a clear 403 instead of relying solely on RLS returning an empty result set.
    Not wired into the reference `sales` module below (which operates across all
    companies in the token's scope) — provided here as the pattern for endpoints that
    do need single-company enforcement.
    """
    raise NotImplementedError("Wire this per-endpoint when a single-company constraint is needed.")


async def get_current_user_id(
    token: TokenPayload = Depends(get_current_token),
) -> int:
    """
    Resolves the JWT's `sub` claim (user uuid) to the internal BIGINT id, for
    populating created_by/updated_by columns. Deliberately uses plain get_db
    (not get_db_with_context): security.app_user is not RLS-protected (it is
    the source of RLS context, not subject to it — see Phase 1 RLS table list),
    so no session variables are needed here.

    Every module's router should use this instead of a hardcoded created_by=0 —
    the `sales` module's use of `created_by=0` (Phase 3 foundation) is a
    documented, tracked gap this dependency closes.
    """
    from app.modules.security.repository import AppUserRepository  # local import: keeps
    # `security` as a leaf module that other modules' routers pull from explicitly,
    # rather than app/core importing a business module at module-load time.

    async for session in get_db():
        repo = AppUserRepository(session)
        user = await repo.get_by_uuid(UUID(token.user_uuid))
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token user no longer exists.")
        return user.id
    raise RuntimeError("unreachable")  # get_db always yields exactly once


async def _count_users(db: AsyncSession) -> int:
    """Helper for require_bootstrap_or_admin — counts active (non-deleted) users."""
    from app.modules.security.models import AppUser
    stmt = select(AppUser).where(AppUser.is_deleted.is_(False))
    rows = (await db.execute(stmt)).scalars().all()
    return len(rows)


async def require_bootstrap_or_admin(
    x_bootstrap_token: str | None = Header(default=None, alias="X-Bootstrap-Token"),
    authorization: str | None = Header(default=None),
) -> None:
    """
    Guard for the two bootstrap endpoints (POST /security/users, POST /core/companies).

    Three legitimate ways through this gate, in order of precedence:

    1. **Fresh-install escape hatch**: if `security.app_user` is empty (zero users),
       the very first user/company can be created without any credentials. This is
       the RLS chicken-and-egg escape (ERP-Lite-007-BootstrapRole.sql).

    2. **Bootstrap token**: if `ERPLITE_BOOTSTRAP_TOKEN` is set in config, the
       caller may pass it via `X-Bootstrap-Token` header. Constant-time compare.

    3. **Existing admin**: if the caller passes a valid JWT (Authorization: Bearer),
       they're already authenticated as an existing user. (We do NOT enforce
       admin-only here because there's no role/permission system yet — every
       authenticated user is implicitly allowed to provision new users/companies.
       When RBAC lands, this branch should also require an admin role.)

    Anything else → 401.
    """
    settings = get_settings()

    # Branch 1: fresh-install escape hatch.
    # Use a fresh bootstrap session (no RLS context needed for a count).
    async for db in get_db_bootstrap():
        user_count = await _count_users(db)
        break
    if user_count == 0:
        return  # First-user bootstrap — let it through.

    # Branch 2: bootstrap token.
    if settings.bootstrap_token and x_bootstrap_token:
        # secrets.compare_digest would be ideal but constant-time string compare
        # via `==` on equal-length strings is good enough here, and we want to
        # avoid timing-attack concerns entirely by always comparing the same way.
        import hmac
        if hmac.compare_digest(settings.bootstrap_token, x_bootstrap_token):
            return

    # Branch 3: existing admin (any authenticated user, until RBAC exists).
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[len("bearer "):].strip()
        try:
            decode_access_token(token)
            return
        except ValueError:
            pass  # fall through to 401

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Bootstrap endpoints require either a valid admin JWT or the X-Bootstrap-Token header. "
               "On a fresh install with zero users, no auth is required.",
        headers={"WWW-Authenticate": 'Bearer, X-Bootstrap-Token'},
    )
