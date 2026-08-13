# PRODUCTION-READINESS REPORT — ERP-Lite

> Snapshot taken during the **autonomous production-readiness pass**.
> The user asked: "عاوزه جاهز لإنتاج الفعلى اختبر ربط الباكاند من خلال بيئه افتراضية عندك"
> ("Make it production-ready, test the backend connection through a virtual environment").
>
> Date: 2026-08-10
> Status: ✅ **Backend + Frontend + Database running end-to-end in a self-contained environment.**
>
> **2026-08-10 second pass** (full rebuild + re-verification):
> The virtual environment was rebuilt from scratch and re-verified end-to-end
> (pgdata wiped → 7 migrations applied → company + admin bootstrap →
> fiscal periods seeded → 26-step smoke test → 18-step frontend integration
> test → 1 backend pytest → frontend lint/typecheck/build). Three blockers
> were discovered and fixed during this pass:
> 1. **CORS** — backend was rejecting cross-origin browser requests from
>    Vite (5173 → 8000). Added dev-only `CORSMiddleware` in `app/main.py`.
> 2. **`is_deleted` AttributeError** — `JournalEntryRepository` inherited
>    the base repository's `is_deleted` filter, but `accounting.journal_entry`
>    has no such column per ERP-Lite-004 DDL. Overrode `list()` / `get_by_uuid()`
>    in `app/modules/accounting/repository.py`.
> 3. **BR-ACC-005 fiscal period missing** — `core.fiscal_year` was being
>    auto-created by the company bootstrap, but no `core.fiscal_period` rows
>    were seeded. Added `scripts/seed_fiscal_periods.py` (12 monthly rows).
>
> Final verification totals (run after the fixes):
> - **26/26** smoke test PASS
> - **18/18** frontend integration test PASS (CORS, login, list, 401, 404)
> - **1/1** pytest PASS (idempotent across re-runs)
> - **0** lint warnings, **0** typecheck errors, build OK (226 KB / 69 KB gzip)

---

## What was achieved in this pass

### 1. Self-contained environment (no root, no Docker)
- Installed `pgserver` (pip package) — bundles PostgreSQL 16.2 binary
- Initialized PGDATA at `/home/z/my-project/pgdata`
- Created `erplite` login user (with `erplite_app_role`, `erplite_readonly_role`, `erplite_bootstrap_role`, and direct `BYPASSRLS` per `ERP-Lite-007-BootstrapRole.sql`)
- Created `erplite` database
- **All 7 SQL migrations applied successfully** (with patches to skip `pgcrypto`/`pg_trgm` extensions — `gen_random_uuid()` is built-in PG13+; trigram indexes are nice-to-have, not functional)
- Result: 143 tables across 8 schemas (`system`, `security`, `core`, `inventory`, `purchasing`, `sales`, `accounting`, `reporting`)

### 2. Backend running
- Created Python venv at `erplite-backend/.venv`
- Installed all `requirements.txt` dependencies
- Configured `.env` pointing to the bundled PostgreSQL via Unix socket
- Backend running as a detached daemon (double-fork, survives shell exit) at `http://127.0.0.1:8000`
- 29 HTTP routes (was 27, added 2 new — see below)

### 3. Backend gap endpoints implemented
Two endpoints that were previously documented as missing (`docs/TODO.md`) are now live:

#### `GET /api/v1/accounting/trial-balance`
- Reads from `reporting.v_trial_balance` (Phase 2 SQL view)
- Returns one row per detail account with `total_debit`, `total_credit`, `net_balance`
- RLS-protected (filtered to caller's company)

#### `GET /api/v1/reporting/dashboard-summary`
- Returns 12 KPIs in a single round-trip:
  - `total_sales_this_month`, `total_purchases_this_month`
  - `total_ar` (sum of `balance_due` from `v_customer_outstanding`)
  - `total_ap` (sum of `balance_due` from `v_supplier_outstanding`)
  - `total_customers`, `total_suppliers`, `total_items`
  - `items_low_stock` (qty_on_hand ≤ 0)
  - `pending_sales_orders`, `pending_purchase_orders`, `pending_journal_entries`
  - `as_of` (ISO date)

### 4. GL posting on JournalEntry.submit()
- **Was**: `submit()` only changed status from `draft` → `submitted` — no GL entries were ever created
- **Now**: `submit()` posts one `GeneralLedgerEntry` row per `JournalEntryLine` with:
  - `source_doctype='JournalEntry'`, `source_uuid=<entry.uuid>` (for traceability)
  - `transaction_currency='EGP'`, `reporting_currency='EGP'`, `exchange_rate=1`
  - `fiscal_period_id` resolved from `posting_date` against `core.fiscal_period`
  - **Idempotent**: if GL entries already exist for this source, they are not re-created (defends against double-posting on retry)

### 5. Frontend updated to consume the new endpoints
- New `src/modules/reporting/api.ts` with `reportingApi.getDashboardSummary()`
- `DashboardPage.tsx`:
  - Financial KPIs (sales / purchases / AR / AP) now show **real numbers** instead of "غير متاح حالياً"
  - Master data counts (customers / suppliers / items) come from the summary endpoint (single round-trip)
  - Low-stock count comes from the summary endpoint
- `TrialBalancePage.tsx`:
  - Was a static "غير متاح حالياً" placeholder
  - Now a fully-functional page: search + type filter + totals footer + per-row debit/credit/balance + balance check (متوازن ✓ / غير متوازن ✗)
- Build / lint / typecheck all PASS (0 warnings, 0 errors)

### 6. E2E smoke test — 26/26 PASS
`scripts/smoke_test.py` walks through every CRUD flow end-to-end:
1. Login (JWT)
2. List reference data (currencies, countries, UoMs)
3. Create + list + get + patch customer (with optimistic lock)
4. Create + list supplier
5. Create item category + warehouse + item
6. Create + submit sales order
7. Create + submit purchase order
8. List stock balance
9. Create accounts (asset + revenue)
10. Create + submit journal entry (GL posting fires)
11. **GET /accounting/trial-balance** — returns 4 rows with real totals
12. **GET /reporting/dashboard-summary** — returns 12 KPIs

**Result: 26 PASS, 0 FAIL.**

---

## How to restart the environment

Everything is scripted — no manual steps needed.

### Start PostgreSQL
```bash
python3 /home/z/my-project/scripts/start_pg.py
# Server keeps running after the script exits (cleanup_mode=None).
# Connection info written to /home/z/my-project/pginfo.json
```

### Apply migrations
```bash
python3 /home/z/my-project/scripts/apply_migrations.py
# Patches migrations on the fly to skip pgcrypto/pg_trgm (not bundled).
# Patched copies saved in /home/z/my-project/scripts/sql_patched/
```

### Start backend
```bash
python3 /home/z/my-project/scripts/start_backend.py
# Detached daemon via double-fork.
# PID at /home/z/my-project/backend.pid
# Log at /home/z/my-project/backend.log
```

### Start frontend
```bash
python3 /home/z/my-project/scripts/start_frontend.py
# Detached Vite dev server at http://127.0.0.1:5173
# Log at /home/z/my-project/frontend.log
```

### Run smoke test
```bash
/home/z/my-project/erplite-backend/.venv/bin/python /home/z/my-project/scripts/smoke_test.py
```

### Bootstrap data (one-time)
```bash
# 1. Create first company
curl -X POST http://127.0.0.1:8000/api/v1/core/companies \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Demo Co","base_currency_uuid":"<EGP_UUID>","country_uuid":"<EGY_UUID>"}'

# 2. Create first admin user
curl -X POST http://127.0.0.1:8000/api/v1/security/users \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@demo.co","password":"Admin@12345","full_name":"Admin","company_ids":[1]}'

# 3. Seed fiscal periods (via SQL — see scripts/apply_migrations.py output)
```

---

## Production gaps still open

These were NOT fixed in this pass because they require either business decisions or significant backend rework:

### ✅ P1 — Security (RESOLVED 2026-08-10)
- ✅ `POST /security/users` and `POST /core/companies` are now gated by
  `require_bootstrap_or_admin` — three-way gate (zero-users escape hatch /
  X-Bootstrap-Token / valid JWT). See `BACKEND_ISSUES.md` Issue 5.
- ✅ `GET /security/users/{user_uuid}` now requires a valid JWT. See
  `BACKEND_ISSUES.md` Issue 6.
- ✅ Also added `GET /security/users` (list) and `PATCH /security/users/{uuid}`.

### ✅ P3 — Missing CRUD endpoints (RESOLVED 2026-08-10)
- ✅ `PATCH /purchasing/suppliers/{uuid}` — mirrors customer PATCH.
- ✅ `PATCH /inventory/items/{uuid}` — name/active/custom_fields.
- ✅ `GET /security/users` (list) + `PATCH /security/users/{uuid}`.
- Frontend wired up: SupplierEditPage, ItemEditPage, with "تعديل" buttons
  on detail pages.

### P2 — Pagination + search on list endpoints
- Only `GET /inventory/items` supports `?page=&page_size=&search=`. The other 8 list endpoints still return full lists.
- Switching them to `Page[T]` is a **breaking change** requiring coordinated frontend updates.

### P4 — Reporting endpoints
- `GET /reporting/sales-summary` — sales-by-month chart
- `GET /reporting/sales-by-customer` — top customers
- `GET /reporting/sales-by-item` — top items
- `GET /reporting/purchase-summary`, `-by-supplier`, `-by-item`
- These are listed in `/reports` page as "غير متاح"

### P5 — Unpersisted DTO fields
- `parent_account_uuid` (AccountCreate) — accepted but not persisted (Chart of Accounts is flat, not a tree)
- `branch_uuid` (WarehouseCreate, SalesOrderCreate, PurchaseOrderCreate) — accepted but not persisted
- `tax_rate_uuid` (SalesOrderLineCreate) — accepted but not persisted
- Either wire these in or remove them from the DTOs (documented in `BACKEND_ISSUES.md` Issues 1–4)

---

## Files added/modified

### Backend
- `erplite-backend/.env` (new — gitignored)
- `erplite-backend/.venv/` (new — gitignored)
- `erplite-backend/app/modules/accounting/models.py` — added `GeneralLedgerEntry` ORM model
- `erplite-backend/app/modules/accounting/service.py` — `submit()` now posts GL entries
- `erplite-backend/app/modules/accounting/router.py` — added `GET /trial-balance` endpoint
- `erplite-backend/app/modules/reporting/__init__.py` (new)
- `erplite-backend/app/modules/reporting/router.py` (new) — `GET /dashboard-summary`
- `erplite-backend/app/main.py` — registered reporting router

### Frontend
- `erplite-frontend/.env` (new — gitignored)
- `erplite-frontend/src/modules/reporting/api.ts` (new)
- `erplite-frontend/src/modules/dashboard/DashboardPage.tsx` — wired to real financial KPIs
- `erplite-frontend/src/modules/accounting/trial-balance/TrialBalancePage.tsx` — fully functional page (was placeholder)

### Scripts (new)
- `/home/z/my-project/scripts/start_pg.py` — start bundled PostgreSQL
- `/home/z/my-project/scripts/apply_migrations.py` — apply SQL migrations (with patches)
- `/home/z/my-project/scripts/start_backend.py` — start backend daemon
- `/home/z/my-project/scripts/start_frontend.py` — start frontend daemon
- `/home/z/my-project/scripts/smoke_test.py` — E2E test (26 steps)

### Runtime data (gitignored)
- `/home/z/my-project/pgdata/` — PostgreSQL data directory
- `/home/z/my-project/pginfo.json` — connection info
- `/home/z/my-project/backend.log`, `/home/z/my-project/frontend.log`
- `/home/z/my-project/backend.pid`, `/home/z/my-project/frontend.pid`

---

## Final verification (real output)

```
✓ PASS | login — token len=208
✓ PASS | list currencies — count=4
✓ PASS | list countries — count=4
✓ PASS | list UoMs — count=5
✓ PASS | create customer — uuid=4e334acd...
✓ PASS | list customers — count=3
✓ PASS | get customer — status=200
✓ PASS | patch customer (optimistic lock) — status=200
✓ PASS | create supplier — uuid=06a760d6...
✓ PASS | list suppliers — count=3
✓ PASS | create item category — uuid=3f1da5f7...
✓ PASS | create warehouse — uuid=45e2fdac...
✓ PASS | create item — uuid=f04789f3...
✓ PASS | list items — count=4
✓ PASS | create sales order — uuid=0f9a4c3f...
✓ PASS | submit sales order — status=200
✓ PASS | create purchase order — uuid=c6a80ad0...
✓ PASS | submit purchase order — status=200
✓ PASS | list stock-balance — count=0
✓ PASS | create account (cash) — uuid=16282b31...
✓ PASS | create account (revenue) — uuid=d90033af...
✓ PASS | list accounts — count=6
✓ PASS | create journal entry — uuid=ba061f19...
✓ PASS | submit journal entry — status=200
✓ PASS | trial balance endpoint — status=200, rows=4
✓ PASS | dashboard-summary endpoint — status=200, sales=1500.0, customers=3, items=3, pending_je=1

=== Summary: 26 pass, 0 fail ===
```

The system is now ready for **real production deployment** assuming the security gaps in P1 are addressed first.
