"""
tests/test_sales_flow.py
Automated version of the manual curl-based end-to-end test performed during
Phase 3 validation. Requires a real PostgreSQL instance with the ERP-Lite-00X
schema + seed data loaded, and the erplite_app role's DATABASE_URL configured
via .env (see .env.example). This is an integration test, not a unit test —
it exercises the real database, real RLS policies, and the real HTTP stack.

Run with: pytest tests/test_sales_flow.py -v
"""
from __future__ import annotations

import asyncio
import time

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.database import get_db_bootstrap
from app.core.security import create_access_token
from app.main import app
from app.modules.security.models import AppUser


@pytest.fixture
def token_company_1() -> str:
    """Look up the real admin user UUID from the DB at test time — hardcoding
    a UUID would break every time the env is rebuilt (which is often during
    development). The token must reference a real user because the
    get_current_user_id dependency looks them up."""
    async def _get_admin_uuid() -> str:
        async for db in get_db_bootstrap():
            stmt = select(AppUser).where(AppUser.username == "admin", AppUser.is_deleted.is_(False))
            user = (await db.execute(stmt)).scalar_one_or_none()
            if user is None:
                pytest.skip("No admin user in DB — bootstrap the env first")
            return str(user.uuid)
        return ""
    admin_uuid = asyncio.get_event_loop().run_until_complete(_get_admin_uuid())
    return create_access_token(user_uuid=admin_uuid, company_ids=[1], tenant_id=1)


@pytest.fixture
def token_other_company() -> str:
    async def _get_admin_uuid() -> str:
        async for db in get_db_bootstrap():
            stmt = select(AppUser).where(AppUser.username == "admin", AppUser.is_deleted.is_(False))
            user = (await db.execute(stmt)).scalar_one_or_none()
            return str(user.uuid) if user else "00000000-0000-0000-0000-000000000000"
        return ""
    admin_uuid = asyncio.get_event_loop().run_until_complete(_get_admin_uuid())
    return create_access_token(user_uuid=admin_uuid, company_ids=[999], tenant_id=1)


@pytest.mark.asyncio
async def test_full_sales_order_lifecycle(token_company_1: str, token_other_company: str):
    # Unique suffix per run — without this, re-running the test would collide
    # with TEST-CUST left over from a previous run (BR-SAL-011-dup).
    suffix = int(time.time() * 1000) % 1_000_000_000
    cust_code = f"TEST-CUST-{suffix}"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {token_company_1}"}

        # 1. Create customer
        resp = await client.post(
            "/api/v1/sales/customers",
            json={"customer_code": cust_code, "customer_name": "Test Customer"},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        customer_uuid = resp.json()["uuid"]

        # 2. Duplicate customer_code must be rejected (BR-SAL-011-dup)
        resp = await client.post(
            "/api/v1/sales/customers",
            json={"customer_code": cust_code, "customer_name": "Duplicate"},
            headers=headers,
        )
        assert resp.status_code == 422

        # 3. Create sales order requires a real item — this test assumes item
        # fixture data is loaded (see conftest.py, not included in this foundation).
        # Left as a documented gap: full fixture setup is a Phase 3 follow-up.
        # 4. Cross-company isolation: the same customer must be invisible to a
        # token scoped to a different company (RLS enforced end-to-end).
        resp = await client.get(
            f"/api/v1/sales/customers/{customer_uuid}",
            headers={"Authorization": f"Bearer {token_other_company}"},
        )
        assert resp.status_code == 404

        # 5. Optimistic locking: update with wrong expected_version_no -> 409
        resp = await client.patch(
            f"/api/v1/sales/customers/{customer_uuid}",
            json={"customer_name": "Renamed", "expected_version_no": 999},
            headers=headers,
        )
        assert resp.status_code == 409
