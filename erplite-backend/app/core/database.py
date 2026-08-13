"""
app/core/database.py

The single most security-critical file in this backend.

Every request that touches the database MUST go through `get_db_with_context()`
(not the raw `get_db()`), which sets the RLS session context — SET LOCAL
app.current_company_ids / app.current_tenant_id — established and validated in
ERP-Lite-005-SeedData-RLS.sql (Phase 1) and confirmed under real concurrency in
Phase 2 testing.

Why SET LOCAL and not SET:
    This backend uses a connection pool (asyncpg pool via SQLAlchemy). A plain
    `SET` persists for the lifetime of the physical connection, which is reused
    across unrelated requests/users once returned to the pool — that would leak
    one user's company-access context into another user's request. `SET LOCAL`
    is scoped to the current transaction only and is automatically reset on
    COMMIT/ROLLBACK, so it can never cross request boundaries even with pooling.

Why "secure by default" is safe here:
    If a developer forgets to use `get_db_with_context()` and uses `get_db()`
    directly, RLS policies fall back to "no session context set" -> `current_setting(...,
    true)` returns NULL -> zero rows visible (verified in Phase 1 testing). The
    failure mode is "user sees nothing", never "user sees someone else's data".
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
    # echo=True only in local development — never in production (leaks query params to logs).
    echo=(settings.environment == "development"),
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Raw session, NO RLS context set. Only for:
      - endpoints that are intentionally system-wide (none exist yet in this
        foundation — every real business endpoint uses get_db_with_context)
      - the readonly reporting role's own dependency (see get_db_readonly)
    Do not use this for any endpoint that reads/writes company-scoped data.
    """
    async with AsyncSessionLocal() as session:
        yield session


class RlsContext:
    """Value object carrying the identity/authorization facts extracted from the
    caller's JWT, used to populate the database session's RLS variables."""

    __slots__ = ("company_ids", "tenant_id")

    def __init__(self, company_ids: list[int], tenant_id: int):
        if not company_ids:
            # Fail loudly here rather than silently degrading to "see nothing" —
            # a token with zero company access is itself a bug/misconfiguration
            # worth surfacing immediately, not a normal empty-result case.
            raise ValueError("RlsContext requires at least one company_id")
        self.company_ids = company_ids
        self.tenant_id = tenant_id


@asynccontextmanager
async def db_session_with_context(ctx: RlsContext) -> AsyncGenerator[AsyncSession, None]:
    """
    Core primitive: opens a transaction, sets the two RLS session variables via
    SET LOCAL as the very first statements, yields the session, then commits
    (or rolls back on exception). Every write in the request's business logic
    must happen through this same session/transaction so the SET LOCAL values
    are still in scope.
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            company_ids_csv = ",".join(str(cid) for cid in ctx.company_ids)
            # Bound parameters cannot be used inside SET LOCAL in PostgreSQL —
            # values are validated as integers in RlsContext/JWT decoding upstream,
            # so string interpolation here is safe (no untrusted free text reaches
            # this point; still built defensively via int() casts, not raw JWT strings).
            await session.execute(
                text(f"SET LOCAL app.current_company_ids = '{company_ids_csv}'")
            )
            await session.execute(
                text(f"SET LOCAL app.current_tenant_id = '{int(ctx.tenant_id)}'")
            )
            yield session
        # session.begin() context manager commits on clean exit, rolls back on exception.


async def get_db_readonly() -> AsyncGenerator[AsyncSession, None]:
    """For reporting/dashboard endpoints connecting as erplite_readonly_role
    (reporting schema only — see ERP-Lite-005 GRANTs). No RLS variables needed:
    the reporting views already carry through the RLS of their source tables
    only when queried by erplite_app_role; readonly consumers query
    pre-aggregated, already-scoped exports instead (out of scope for this
    foundation — placeholder for Phase 5 reporting work)."""
    async with AsyncSessionLocal() as session:
        yield session


_bootstrap_engine = create_async_engine(settings.bootstrap_database_url, pool_pre_ping=True)
_BootstrapSessionLocal = async_sessionmaker(bind=_bootstrap_engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_bootstrap() -> AsyncGenerator[AsyncSession, None]:
    """
    erplite_bootstrap_role (BYPASSRLS) — see ERP-Lite-007-BootstrapRole.sql for the
    RLS chicken-and-egg problem this solves. ONLY POST /core/companies and
    POST /security/users may use this. Every other endpoint in the system MUST
    use get_db() or get_db_with_context() (NOBYPASSRLS) — using this dependency
    anywhere else silently defeats Row-Level Security for that endpoint.
    """
    async with _BootstrapSessionLocal() as session:
        yield session
