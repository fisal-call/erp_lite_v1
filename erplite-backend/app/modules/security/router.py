"""
app/modules/security/router.py
Uses plain get_db (no RLS context) deliberately: `security.app_user` and
`security.user_company_access` are NOT RLS-protected tables (they are the
source of RLS context, not subject to it) — see Phase 1 RLS table list.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_db_bootstrap
from app.core.dependencies import get_current_token, require_bootstrap_or_admin
from app.core.exceptions import BusinessRuleViolation, ConcurrencyConflict, NotFoundError
from app.modules.security.repository import AppUserRepository, UserCompanyAccessRepository
from app.modules.security.schemas import Token, UserCreate, UserPatch, UserRead, UserSummaryRead
from app.modules.security.service import AuthService, UserService

router = APIRouter(prefix="/security", tags=["security"])


def _domain_error_to_http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ConcurrencyConflict):
        return HTTPException(status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, BusinessRuleViolation):
        code = status.HTTP_401_UNAUTHORIZED if exc.rule_id.startswith("AUTH") else status.HTTP_422_UNPROCESSABLE_ENTITY
        return HTTPException(code, detail=str(exc))
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected error")


@router.post("/auth/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db_bootstrap)):
    # Uses get_db_bootstrap (BYPASSRLS), not get_db: reading a user's OWN
    # company-access grants to build their RLS context is itself gated by RLS
    # on user_company_access — a login-time chicken-and-egg identical to company
    # creation (see ERP-Lite-007-BootstrapRole.sql). Not an information leak:
    # the query is always scoped to the single user_id that already passed
    # password verification in this same request.
    service = AuthService(AppUserRepository(db), UserCompanyAccessRepository(db))
    try:
        token = await service.login(username=form.username, password=form.password)
    except BusinessRuleViolation as exc:
        raise _domain_error_to_http(exc) from exc
    await db.commit()  # AuthService only reads, but commit releases the transaction cleanly
    return Token(access_token=token)


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_bootstrap_or_admin)])
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db_bootstrap)):
    # SECURITY (resolved 2026-08-10, was Issue 5 in BACKEND_ISSUES.md):
    # The endpoint is now gated by `require_bootstrap_or_admin`. Three ways
    # through: (1) zero users in DB → fresh-install escape hatch; (2) caller
    # passes the configured X-Bootstrap-Token header; (3) caller passes a
    # valid JWT (any authenticated user — RBAC not yet in place).
    #
    # Still uses the BYPASSRLS bootstrap connection (ERP-Lite-007): granting a
    # brand-new user's FIRST company access is the other half of the same
    # chicken-and-egg problem as company creation — see
    # app/core/database.py::get_db_bootstrap.
    service = UserService(AppUserRepository(db), UserCompanyAccessRepository(db))
    try:
        user = await service.create(payload)
        await db.commit()
    except BusinessRuleViolation as exc:
        await db.rollback()
        raise _domain_error_to_http(exc) from exc
    return user


@router.get("/users", response_model=list[UserSummaryRead],
            dependencies=[Depends(get_current_token)])
async def list_users(db: AsyncSession = Depends(get_db_bootstrap)):
    """List all users. Requires a valid JWT (any authenticated caller, until
    RBAC lands — then this should be admin-only). Uses the bootstrap connection
    because security.app_user is not RLS-protected."""
    repo = AppUserRepository(db)
    rows, _ = await repo.list(limit=200, offset=0)
    return rows


@router.get("/users/{user_uuid}", response_model=UserRead,
            dependencies=[Depends(get_current_token)])
async def get_user(user_uuid: UUID, db: AsyncSession = Depends(get_db_bootstrap)):
    # SECURITY (resolved 2026-08-10, was Issue 6 in BACKEND_ISSUES.md): now
    # requires a valid JWT (via get_current_token dependency). The bootstrap
    # connection is still used because security.app_user is not RLS-protected.
    # When RBAC lands, restrict to admin or self.
    repo = AppUserRepository(db)
    user = await repo.get_by_uuid(user_uuid)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"AppUser not found: {user_uuid}")
    return user


@router.patch("/users/{user_uuid}", response_model=UserRead,
              dependencies=[Depends(get_current_token)])
async def patch_user(
    user_uuid: UUID,
    payload: UserPatch,
    db: AsyncSession = Depends(get_db_bootstrap),
):
    """Update a user's mutable fields. Currently supports:
       - full_name, email (with optimistic locking on version_no)
       - is_active (deactivate / reactivate)
       - password (replaced if non-null)
       - company_ids (replaced wholesale if non-null)

    Uses get_db_bootstrap (BYPASSRLS) because user_company_access is
    RLS-protected (FORCE) and the replacement of company_ids needs DELETE —
    erplite_app_role doesn't have DELETE on that table (ERP-Lite-005 grants
    only SELECT/INSERT/UPDATE; soft-delete is the documented pattern but
    user_company_access is a pure join table, hard-delete is correct here).
    The bootstrap role was extended (2026-08-10) to also have UPDATE/DELETE
    on these two tables for this endpoint.
    """
    service = UserService(AppUserRepository(db), UserCompanyAccessRepository(db))
    try:
        user = await service.update(user_uuid, payload)
        await db.commit()
    except (NotFoundError, BusinessRuleViolation, ConcurrencyConflict) as exc:
        await db.rollback()
        raise _domain_error_to_http(exc) from exc
    return user
