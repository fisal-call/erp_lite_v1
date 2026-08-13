# TODO — ERP-Lite Frontend

> Condensed backlog. Full details in `BACKEND_REQUIRED.md` (backend gaps) and
> `docs/FRONTEND_STATUS.md` §"Remaining" (frontend polish).
>
> **2026-08-10 update**: P0 is DONE — full stack runs end-to-end in a
> self-contained environment (PostgreSQL + FastAPI + Vite). See
> `docs/PRODUCTION_READINESS.md`. P1 items #1 and #2 are also DONE — both
> endpoints are live and wired into the frontend.
>
> **2026-08-10 second pass**: validated against a freshly-rebuilt PostgreSQL
> instance from scratch (pgdata wiped → migrations applied → bootstrap).
> Additional fixes shipped this pass:
> - **CORS** added to backend (only in development) — was blocking every
>   browser request cross-origin.
> - **`is_deleted` bug** in `JournalEntryRepository` fixed (the base
>   repository assumed the column existed; `accounting.journal_entry` per
>   ERP-Lite-004 DDL has no `is_deleted`).
> - **Fiscal-period seed script** added (`scripts/seed_fiscal_periods.py`)
>   — without it, JournalEntry.submit() failed with `BR-ACC-005`.
> - **pytest** integration test fixed (real admin UUID + unique customer_code).
> - Frontend integration test (`scripts/frontend_integration_test.py`, 18
>   steps) added — verifies CORS + 401 + 404 + every list endpoint shape.
>
> Verification totals this pass: **26 smoke + 18 integration + 1 pytest +
> 0 lint warnings + 0 typecheck errors + build OK**.

---

## ✅ P0 — Validate against a running backend (DONE)
- [x] Start PostgreSQL + apply SQL migrations from `/home/z/my-project/sql/`
      — via `pgserver` pip package (PostgreSQL 16.2 bundled)
- [x] Start FastAPI: detached daemon via `scripts/start_backend.py`
- [x] Start frontend: detached Vite dev server via `scripts/start_frontend.py`
- [x] Login + run the smoke-test sequence — `scripts/smoke_test.py` (26/26 PASS)
- [x] Fix drift between documented contract and actual backend behavior
      — multiple field names verified correct in frontend (customer_code,
        supplier_code, item_category_uuid, document_date, posting_date,
        qty_ordered, rate, debit_amount, credit_amount)
- [x] **CORS** middleware added to backend (dev-only) — was missing
- [x] **`is_deleted`** filter override in `JournalEntryRepository` — was 500'ing
- [x] **fiscal_period** seed script — JE submit was failing with BR-ACC-005
- [x] **frontend integration test** — verifies browser-side end-to-end

---

## ✅ P1 — HIGH-priority backend gaps (DONE)

### 1. `GET /api/v1/reporting/dashboard-summary` — IMPLEMENTED
- **Used by**: Dashboard (`/`) — financial KPIs now show real numbers
- **Returns**: total_sales_this_month, total_purchases_this_month, total_ar,
              total_ap, total_customers, total_suppliers, total_items,
              items_low_stock, pending_sales_orders, pending_purchase_orders,
              pending_journal_entries, as_of
- **Source**: `app/modules/reporting/router.py`

### 2. `GET /api/v1/accounting/trial-balance` — IMPLEMENTED
- **Used by**: Trial Balance page (`/accounting/trial-balance`)
- **Returns**: account_code, account_name, account_type, total_debit,
              total_credit, net_balance (one row per detail account)
- **Source**: `app/modules/accounting/router.py`
- **Note**: requires GL posting on JE submit — also implemented
           (`accounting/service.py::submit`)

### 3. GL posting on JournalEntry.submit() — IMPLEMENTED
- Each JE line now produces one GeneralLedgerEntry row on submit
- Idempotent (safe to retry after partial failure)
- Source: `app/modules/accounting/service.py::submit`

---

## 🔴 Still open

### P2 — Pagination + search on list endpoints
Currently only `GET /inventory/items` supports `?page=&page_size=&search=`.
Add the same to:
- `GET /sales/customers`
- `GET /sales/sales-orders`
- `GET /purchasing/suppliers`
- `GET /purchasing/purchase-orders`
- `GET /accounting/accounts`
- `GET /accounting/journal-entries`
- `GET /inventory/warehouses`
- `GET /inventory/item-categories`
- `GET /inventory/stock-balance`

> ⚠️ **Breaking change**: switching `list[T]` → `Page[T]` requires coordinated
> frontend updates. The frontend's `api.ts` files will need to unwrap `.items`.

### ✅ P3 — Security (RESOLVED 2026-08-10)
- ✅ Lock down `POST /security/users` + `POST /core/companies` — gated by
  `require_bootstrap_or_admin` (three-way: zero users escape hatch /
  `X-Bootstrap-Token` header / valid JWT).
- ✅ Add auth dependency to `GET /security/users/{user_uuid}` — now requires
  a valid JWT via `get_current_token`.
- Added `ERPLITE_BOOTSTRAP_TOKEN` env var (optional). When set, this token
  unlocks the bootstrap endpoints even after the first admin exists.
- Added `GET /security/users` (list) and `PATCH /security/users/{uuid}`.
- Extended `erplite_bootstrap_role` grants to include UPDATE/DELETE on
  `security.app_user` and `security.user_company_access` (needed for PATCH).
- See `BACKEND_ISSUES.md` Issues 5 and 6 — both marked RESOLVED.

### ✅ P4 — Missing CRUD endpoints (RESOLVED 2026-08-10)
- ✅ `GET /security/users` (list) — returns `UserSummaryRead[]`
- ✅ `PATCH /security/users/{uuid}` — full_name/email/is_active/password/
  company_ids + optimistic lock
- ✅ `PATCH /purchasing/suppliers/{uuid}` — mirrors customer PATCH exactly
  (supplier_code not editable)
- ✅ `PATCH /inventory/items/{uuid}` — item_name/is_active/custom_fields
  (item_code/category/uom not editable)
- Frontend wired up: `SupplierEditPage.tsx`, `ItemEditPage.tsx`, both
  detail pages now have an "تعديل" button.
- Routes registered in App.tsx:
  `/purchasing/suppliers/:uuid/edit`, `/inventory/items/:uuid/edit`.

### P5 — Reporting endpoints (all listed in /reports page as "غير متاح")
- `GET /api/v1/reporting/sales-summary`
- `GET /api/v1/reporting/sales-by-customer`
- `GET /api/v1/reporting/sales-by-item`
- `GET /api/v1/reporting/purchase-summary`
- `GET /api/v1/reporting/purchase-by-supplier`
- `GET /api/v1/reporting/purchase-by-item`

### P6 — Wire (or remove) the 4 unpersisted DTO fields
Per backend audit (`BACKEND_ISSUES.md` Issues 1–4):
| Field | DTO | Status |
|---|---|---|
| `parent_account_uuid` | `AccountCreate` | accepted, not persisted |
| `branch_uuid` | `WarehouseCreate` | accepted, not persisted |
| `branch_uuid` | `SalesOrderCreate` | accepted, not persisted (hardcoded None) |
| `tax_rate_uuid` | `SalesOrderLineCreate` | accepted, not persisted in line loop |

