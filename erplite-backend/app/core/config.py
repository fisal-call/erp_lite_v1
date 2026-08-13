"""
app/core/config.py
Central application settings, loaded from environment variables.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ERPLITE_", extra="ignore")

    # Database — connects as erplite_app_role (NOBYPASSRLS, per ERP-Lite-005-SeedData-RLS.sql).
    # Never connect the application as a superuser/BYPASSRLS role — that would silently defeat
    # the entire Row-Level Security model validated in Phase 1/2.
    database_url: str = "postgresql+asyncpg://erplite_app:CHANGE_ME@localhost:5432/erplite"
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # Bootstrap-only connection (erplite_bootstrap_role, BYPASSRLS) — used exclusively by
    # POST /core/companies and POST /security/users. See ERP-Lite-007-BootstrapRole.sql
    # for why this second, narrowly-scoped connection is unavoidable (RLS chicken-and-egg
    # problem for the very first company/user). Defaults to database_url's host/db with
    # different credentials in production; kept as its own setting so it can point at a
    # role with strictly fewer standing privileges than "just use the app role and hope".
    bootstrap_database_url: str = "postgresql+asyncpg://erplite_bootstrap:CHANGE_ME@localhost:5432/erplite"

    # JWT
    jwt_secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    # AD-001: tenant_id is reserved with a fixed default until Multi-Tenant is activated.
    default_tenant_id: int = 1

    api_v1_prefix: str = "/api/v1"
    environment: str = "development"

    # Bootstrap guard: when set, POST /security/users and POST /core/companies require
    # this token via the X-Bootstrap-Token header (UNLESS security.app_user is empty,
    # in which case the very first user can still be created without any auth — the
    # true chicken-and-egg escape hatch). Leave empty in fresh installs to allow
    # initial setup; set to a strong random value immediately after the first admin
    # is created, then never change it. Recommended length: 32+ chars from `secrets.token_urlsafe(32)`.
    bootstrap_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
