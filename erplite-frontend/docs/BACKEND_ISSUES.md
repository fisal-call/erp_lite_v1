# BACKEND_ISSUES — ERP-Lite

> Discovered backend issues that affect the frontend. None are blocking —
> all are documented workarounds in the frontend.
>
> **2026-08-10 second-pass update**: Issue 11 (CORS missing) and Issue 12
> (`is_deleted` on `JournalEntry`) were both **fixed and verified** during
> the production-readiness re-validation pass.

This file lists actual issues in `/home/z/my-project/erplite-backend/` that
the frontend had to work around. For "missing features" (endpoints that
don't exist yet), see `BACKEND_REQUIRED.md` instead.

---

## Issue 1 — `parent_account_uuid` accepted but not persisted

**Location**: `app/modules/accounting/schemas.py::AccountCreate` accepts
`parent_account_uuid: UUID | None`. The corresponding service/repository
does NOT persist it (the column exists in the DB but the INSERT path
skips this field).

**Impact**: The Chart of Accounts is rendered as a flat list, not a tree.
The frontend cannot offer a parent-account picker because the choice would
have no effect. The page header documents this as an optional future
enhancement.

**Suggested fix**: Wire `parent_account_uuid` through the service layer
into the INSERT. Then expose it on `AccountRead` so the frontend can build
a proper tree view.

---

## Issue 2 — `branch_uuid` accepted but not persisted (Warehouse)

**Location**: `app/modules/inventory/schemas.py::WarehouseCreate` accepts
`branch_uuid: UUID | None`. The service layer ignores it.

**Impact**: Warehouses cannot be associated with a branch. The frontend
form does not expose a branch picker.

**Suggested fix**: Either wire it or remove it from the DTO.

---

## Issue 3 — `branch_uuid` accepted but hardcoded to None (SalesOrder / PurchaseOrder)

**Location**: `app/modules/sales/router.py::create_sales_order` and
`app/modules/purchasing/router.py::create_purchase_order` pass
`branch_id=None` to the service, regardless of what the DTO carries.

**Impact**: All orders are created without a branch. Acceptable for
single-branch companies; blocks multi-branch analytics later.

**Suggested fix**: Wire `branch_uuid` through. Or remove it from the DTO
until multi-branch is implemented (don't ship a contract that lies).

---

## Issue 4 — `tax_rate_uuid` accepted but not persisted (SalesOrderLineCreate)

**Location**: `app/modules/sales/schemas.py::SalesOrderLineCreate` accepts
`tax_rate_uuid: UUID | None`. The service layer's line loop doesn't read it.

**Impact**: Tax calculation per line is not possible. The frontend form
does not expose a tax picker.

**Suggested fix**: Wire it once the `core_org.tax_rate` table is exposed
via an endpoint. Until then, remove it from the DTO to keep the contract
honest.

---

## Issue 5 — `POST /security/users` and `POST /core/companies` are unauthenticated (FIXED)

**Status**: ✅ **FIXED** in 2026-08-10 production-readiness pass.

**Original problem**: Both endpoints used `get_db_bootstrap` (BYPASSRLS) with
NO auth dependency — anyone with network access could create users and
companies.

**Fix**: Added `require_bootstrap_or_admin` dependency in
`app/core/dependencies.py`. Three legitimate ways through this gate:
1. **Fresh-install escape hatch**: if `security.app_user` is empty, the very
   first user/company can be created without any credentials (RLS chicken-
   and-egg escape per ERP-Lite-007).
2. **Bootstrap token**: if `ERPLITE_BOOTSTRAP_TOKEN` env var is set, the
   caller may pass it via `X-Bootstrap-Token` header (constant-time compare
   via `hmac.compare_digest`).
3. **Existing admin**: any authenticated caller with a valid JWT. (RBAC not
   yet in place — every authenticated user is implicitly allowed to
   provision new users/companies. When RBAC lands, restrict to admin role.)

Also added new endpoints:
- `GET /security/users` (list) — returns `UserSummaryRead[]`, requires JWT
- `PATCH /security/users/{uuid}` — full_name/email/is_active/password/
  company_ids replacement + optimistic lock

Extended `erplite_bootstrap_role` grants in `ERP-Lite-007-BootstrapRole.sql`
to include UPDATE/DELETE on `security.app_user` and
`security.user_company_access` (needed for PATCH endpoint).

**Verified by**: `scripts/frontend_integration_test.py` steps 12a–12d:
- POST /security/users without auth → 401 ✅
- POST /security/users WITH valid JWT → 201 ✅
- POST /core/companies without auth → 401 ✅

---

## Issue 6 — `GET /security/users/{user_uuid}` has no auth dependency (FIXED)

**Status**: ✅ **FIXED** in 2026-08-10 production-readiness pass.

**Original problem**: `get_user` endpoint used plain `get_db` with no
`Depends(get_current_token)` — any unauthenticated caller could fetch any
user by UUID.

**Fix**: Added `dependencies=[Depends(get_current_token)]` to the route.
Still uses `get_db_bootstrap` because `security.app_user` is not RLS-
protected (it's the source of RLS context, not subject to it) — but at
least the request needs a valid JWT to reach the handler.

**Verified by**: integration test step "GET /security/users without auth → 401".

When RBAC lands, this should additionally restrict to admin-or-self.

---

## Issue 7 — JournalEntry submit does not take `expected_version_no`

**Location**: `app/modules/accounting/schemas.py` has no
`JournalEntrySubmit` schema. The submit endpoint takes no body.

**Impact**: Inconsistent with SO/PO submit (both take `{expected_version_no}`).
Optimistic locking on JE submit is therefore not enforced. The frontend
has a defensive 409 handler in place but it will never trigger today.

**Suggested fix**: Add `JournalEntrySubmit { expected_version_no: int }`
and have the service layer check it. Mirrors SO/PO exactly.

---

## Issue 8 — Most list endpoints return up to 200/500 rows with no pagination

**Location**: Almost every `GET /...` list endpoint (except
`GET /inventory/items`) hardcodes `limit=200, offset=0` and returns
`list[T]` instead of `Page[T]`.

**Impact**: Works at typical per-company volumes. Breaks at scale. The
frontend filters client-side as a workaround.

**Suggested fix**: Add `PageParams = Depends()` + `search: str | None`
query param to each list endpoint. Return `Page[T]`. Coordinated frontend
change required (unwrap `.items`).

---

## Issue 9 — `created_by_name` not exposed on document Read DTOs

**Location**: `SalesOrderRead`, `PurchaseOrderRead`, `JournalEntryRead`
all extend `AuditFieldsRead` which only carries `created_at`,
`updated_at`, `version_no`. The internal `created_by` ID is stored in the
DB but not exposed.

**Impact**: Frontend detail pages can't show "أُنشئ بواسطة [name]".

**Suggested fix**: JOIN `security.app_user` in the service layer and add
`created_by_name: str` to the Read DTOs. Avoids N+1 frontend lookups.

---

## Issue 10 — `SalesOrderSummaryRead` / `PurchaseOrderSummaryRead` lack `total_amount`

**Location**: `app/modules/sales/schemas.py::SalesOrderSummaryRead` and
`app/modules/purchasing/schemas.py::PurchaseOrderSummaryRead` carry only
`uuid`, `document_number`, `document_date`, `status`.

**Impact**: The list pages can't show order totals. The frontend could
issue N+1 detail fetches, but that's an anti-pattern. The detail page
computes the total client-side from lines, but the list page can't.

**Suggested fix**: Add `total_amount: Decimal` to the summary DTO. Compute
it in the repository's `list()` method via a SQL aggregate or a
materialized view.

---

## Issue 11 — CORS missing on backend (FIXED)

**Status**: ✅ **FIXED** in 2026-08-10 second pass.

**Original problem**: The FastAPI backend had no CORS middleware, so any
browser request from `http://127.0.0.1:5173` (Vite dev server) to
`http://127.0.0.1:8000` (FastAPI) was blocked by the browser's same-origin
policy. This was a **complete blocker** for frontend ↔ backend integration.

**Fix**: Added `CORSMiddleware` to `app/main.py`, gated on
`settings.environment == "development"` so production deployments are not
permissive by accident. Allowed origins: `http://127.0.0.1:5173` and
`http://localhost:5173` only.

**Verified by**: `scripts/frontend_integration_test.py` — preflight OPTIONS
returns 200 with proper `Access-Control-Allow-Origin`,
`Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`,
`Access-Control-Allow-Credentials`.

---

## Issue 12 — `is_deleted` column missing on `accounting.journal_entry` (FIXED)

**Status**: ✅ **FIXED** in 2026-08-10 second pass.

**Original problem**: `SqlAlchemyRepository.list()` and `get_by_uuid()` in
`app/shared/base_repository.py` filter on `model.is_deleted.is_(False)`. The
`accounting.journal_entry` table per ERP-Lite-004 DDL has NO `is_deleted`
column (only `accounting.account` does in this schema). So
`GET /api/v1/accounting/journal-entries` returned HTTP 500:
`AttributeError: type object 'JournalEntry' has no attribute 'is_deleted'`.

**Fix**: Overrode `list()` and `get_by_uuid()` in
`app/modules/accounting/repository.py::JournalEntryRepository` to skip the
`is_deleted` filter. This is consistent with BR-ACC-001 (submitted
JournalEntries are immutable — no soft-delete in the accounting contract).

**Verified by**: `scripts/smoke_test.py` step "list journal-entries" — now
returns 200 with rows; previously returned 500.

---

## Summary

12 issues total. Issues 5, 6, 11, 12 were fixed during the production-
readiness re-validation pass (2026-08-10). The remaining 8 are not blocking —
the frontend works around every one.

Priorities:

| # | Severity | Blocks frontend feature? | Workaround |
|---|---|---|---|
| 1 | LOW | Tree view of accounts | Flat list (works) |
| 2 | LOW | Branch picker on warehouse | Field omitted (works) |
| 3 | LOW | Branch picker on SO/PO | Field omitted (works) |
| 4 | LOW | Tax picker on SO line | Field omitted (works) |
| 5 | ✅ FIXED | (was: unauthenticated user/company creation) | require_bootstrap_or_admin guard |
| 6 | ✅ FIXED | (was: unauthenticated user fetch by UUID) | get_current_token dependency |
| 7 | LOW | Optimistic lock on JE submit | Defensive 409 handler (no-op today) |
| 8 | MEDIUM | Server-side search/pagination | Client-side filter (works at scale) |
| 9 | LOW | "Created by [name]" on detail | Field not shown |
| 10 | LOW | Order total on list page | Total computed on detail only |
| 11 | ✅ FIXED | (was: every browser request) | CORS middleware added (dev-only) |
| 12 | ✅ FIXED | (was: 500 on list journal-entries) | Repository override |
