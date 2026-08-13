# AI_HANDOFF — ERP-Lite Frontend

> **For**: Aider + DeepSeek (or Claude Code, Codex CLI)
> **From**: Super Z (autonomous continuation pass — round 2)
> **Date**: 2026-08-10
> **Working directory**: `/home/z/my-project/erplite-frontend/`

This document is the **single entry point** for any AI agent picking up the
ERP-Lite frontend. It tells you what's done, what's missing, what NOT to
touch, and the exact commands to run.

**Round 2 highlights** (what changed since round 1):
- All 32 routes lazy-loaded → main bundle dropped from 525 KB / 150 KB gzip
  to **224 KB / 69 KB gzip**; per-page chunks 2–12 KB each
- New UI primitives: `SortableTh`, `useSort`, `useListboxKeyboard`, `useUrlState`
- All 4 autocompletes now have keyboard nav (ArrowDown/Up/Enter/Esc) + ARIA combobox roles
- All 11 list pages now have sortable columns + skeleton loaders + URL-persisted filters
- Dashboard KPI tiles show per-tile skeleton loaders instead of a single full-page spinner
- LoginPage got a branded card + password show/hide toggle
- Added 404 NotFound page at `*` route
- lint/tsc/build all PASS, 73 files, 0 warnings, 0 errors

---

## 1. Project Architecture (high level)

```
/home/z/my-project/
├── erplite-frontend/          ← THIS project (React + Vite + TS + Tailwind)
│   ├── src/                   ← application source (68 files)
│   ├── docs/                  ← status, handoff, todo, decisions (this file lives here)
│   ├── BACKEND_REQUIRED.md    ← exhaustive list of backend gaps
│   ├── README.md              ← quick start
│   ├── package.json           ← scripts: dev / build / lint / preview
│   └── vite.config.ts         ← Vite + Tailwind plugin
├── erplite-backend/           ← FastAPI source of truth (DO NOT modify in this pass)
│   ├── app/main.py            ← composes 6 routers
│   ├── app/modules/{security,core_org,inventory,sales,purchasing,accounting}/
│   │   └── {router,service,repository,schemas,models}.py
│   └── app/core/{config,security,database,dependencies,exceptions}.py
└── sql/                       ← PostgreSQL migrations (Phase 1/2/3 + RLS)
```

---

## 2. Frontend Architecture

### Stack
- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **TanStack Query 5** (server state — cache, retries, invalidation)
- **react-hook-form 7** + **Zod 4** (form state + validation)
- **axios** (HTTP client)
- **react-router-dom 7** (routing)
- **oxlint** (lint)

### Folder layout
```
src/
├── App.tsx                          ← Route table + providers (QueryClient + Auth + Toast + Router)
├── main.tsx                         ← bootstrap (mounts <App/>)
├── index.css                        ← design system + print styles + .ltr-text + .input
│
├── api/client.ts                    ← axios instance + JWT + 401 + ApiError + describeError
│
├── auth/
│   ├── AuthContext.tsx              ← <AuthProvider> component (components-only file)
│   ├── auth-state.ts                ← AuthContext + useAuth (non-component exports)
│   ├── ProtectedRoute.tsx           ← redirect to /login if not authed
│   └── LoginPage.tsx                ← OAuth2 password-form login
│
├── layout/AppLayout.tsx             ← RTL layout: sidebar (md+) + drawer (mobile) + topbar
│
├── components/
│   ├── ui/                          ← shared primitives (see §3 below)
│   ├── CustomerAutocomplete.tsx
│   ├── SupplierAutocomplete.tsx
│   ├── ItemAutocomplete.tsx
│   ├── AccountAutocomplete.tsx      ← NEW: searchable account picker
│   └── StatusBadge.tsx              ← 7-status pill (PDR-002)
│
├── modules/
│   ├── dashboard/DashboardPage.tsx  ← real KPIs only
│   ├── sales/
│   │   ├── api.ts                   ← salesApi (typed wrappers around /sales/*)
│   │   ├── types.ts                 ← Customer / SalesOrder TypeScript types
│   │   ├── customers/               ← CustomersListPage / FormPage / DetailPage / EditPage
│   │   └── orders/                  ← SalesOrdersListPage / FormPage / DetailPage
│   ├── purchasing/
│   │   ├── api.ts
│   │   ├── types.ts
│   │   ├── suppliers/               ← SuppliersListPage / FormPage / DetailPage
│   │   └── orders/                  ← PurchaseOrdersListPage / FormPage / DetailPage
│   ├── inventory/
│   │   ├── api.ts                   ← Item / ItemCategory / Warehouse / StockBalance
│   │   ├── items/                   ← ItemsListPage / FormPage / DetailPage (NEW)
│   │   ├── categories/              ← ItemCategoriesPage (list + inline create)
│   │   ├── warehouses/              ← WarehousesPage (list + inline create)
│   │   └── StockBalancePage.tsx     ← read-only with search + filters + print
│   ├── accounting/
│   │   ├── api.ts                   ← Account / JournalEntry
│   │   ├── AccountsPage.tsx         ← list + inline create (search + type filter + color badges)
│   │   ├── JournalEntriesListPage.tsx
│   │   ├── JournalEntryFormPage.tsx ← uses AccountAutocomplete + live balance check
│   │   ├── JournalEntryDetailPage.tsx ← resolves account UUIDs → names + print + submit
│   │   └── trial-balance/TrialBalancePage.tsx ← "غير متاح" panel (backend gap)
│   ├── core-org/api.ts              ← Currency / Country / UnitOfMeasure (read-only)
│   ├── reports/ReportsIndexPage.tsx ← catalog of reports with availability badges
│   └── settings/
│       ├── SettingsIndexPage.tsx    ← catalog of settings with "غير متاح" panels
│       └── reference/               ← NEW: read-only reference data landing + 3 list pages
│           ├── ReferenceDataPage.tsx
│           ├── CurrenciesPage.tsx
│           ├── CountriesPage.tsx
│           └── UnitsOfMeasurePage.tsx
│
└── pages/NotFoundPage.tsx
```

### Patterns to follow
- **API layer**: every backend call lives in `modules/<x>/api.ts`. Never call axios from a component.
- **Types**: every TypeScript interface mirrors the Pydantic schema 1:1 (uuid only, never internal id).
- **Pages**: import primitives from `components/ui` (never drill into individual files).
- **Forms**: RHF + Zod, Arabic error messages, `useToast()` for success/error, disabled submit while pending.
- **Detail pages**: use `<DetailField>` (not ad-hoc Row), `<BooleanBadge>` for active/inactive.
- **List pages**: use `<FilterBar>` + `<CountSummary>` + `<Table>` + clickable rows.
- **Sensitive actions** (submit SO/PO/JE): wrap in `<ConfirmDialog>`.
- **Backend gaps**: show a clear "غير متاح حالياً" panel + reference to `BACKEND_REQUIRED.md`. NEVER invent data.

### Lint rule (one to remember)
`react/only-export-components` — files that export a React component must NOT
also export non-component values. Solution (pattern used by `auth/AuthContext.tsx`
and `components/ui/Toast.tsx`): keep the context + hook in a sibling `-state.ts`
file. Don't break this or you'll get a Fast Refresh warning.

---

## 3. UI Primitives

All in `src/components/ui/`, re-exported from `src/components/ui/index.ts`:

| Component | When to use |
|---|---|
| `Card` | Surface container for any panel |
| `KpiCard` | Dashboard KPI (supports `available={false}` → "غير متاح") |
| `PageHeader` | Page title row (with optional `actions` slot for buttons) |
| `Spinner` | Centered loading |
| `EmptyState` | "لا توجد بيانات" placeholder |
| `ErrorState` | Error placeholder (Arabic message + optional retry) |
| `ConfirmDialog` | Modal before irreversible action (RTL) |
| `Table` + `Th` + `Td` | Responsive table (overflow-x-auto on mobile) |
| `ToastProvider` + `useToast` | Wrap App once; call `useToast().success(...)` anywhere |
| `BooleanBadge` | Active/inactive pill (or any true/false state with custom labels) |
| `Skeleton` | Loading skeleton (lines or single block) |
| `DetailField` | Read-only label/value row for detail pages |
| `FilterBar` | Search + filters + clear-filters toolbar |
| `CountSummary` | "عرض X من Y" with optional status breakdown |

---

## 4. Backend Architecture (summary — source of truth: `/home/z/my-project/erplite-backend/`)

### Stack
- **FastAPI** + **SQLAlchemy 2 (async)** + **PostgreSQL 16** + **Pydantic v2**
- **Row-Level Security** (RLS) on every company-scoped table — JWT carries `company_ids` + `tenant_id`
- **Two DB roles**: `erplite_app` (NOBYPASSRLS, normal requests) and `erplite_bootstrap` (BYPASSRLS, only for first-user/first-company creation)

### Endpoint inventory (33 endpoints across 6 routers)

| Module | Endpoints |
|---|---|
| security | `POST /security/auth/login`, `POST /security/users`, `GET /security/users/{uuid}` |
| core_org | `POST /core/companies`, `GET /core/currencies`, `GET /core/countries`, `GET /core/units-of-measure` |
| inventory | `POST/GET /inventory/item-categories`, `POST /inventory/items`, `GET /inventory/items` (paginated+search), `GET /inventory/items/{uuid}`, `POST/GET /inventory/warehouses`, `GET /inventory/stock-balance` |
| purchasing | `POST/GET /purchasing/suppliers`, `GET /purchasing/suppliers/{uuid}`, `POST/GET /purchasing/purchase-orders`, `GET /purchasing/purchase-orders/{uuid}`, `POST /purchasing/purchase-orders/{uuid}/submit` |
| sales | `POST/GET /sales/customers`, `GET /sales/customers/{uuid}`, `PATCH /sales/customers/{uuid}`, `POST/GET /sales/sales-orders`, `GET /sales/sales-orders/{uuid}`, `POST /sales/sales-orders/{uuid}/submit` |
| accounting | `POST/GET /accounting/accounts`, `GET/POST /accounting/journal-entries`, `GET /accounting/journal-entries/{uuid}`, `POST /accounting/journal-entries/{uuid}/submit` |

**Prefix**: `/api/v1` (set in `app/core/config.py`)

### Critical business rules enforced by the backend (the frontend mirrors)
- **PDR-001 (optimistic locking)**: every mutating endpoint takes `expected_version_no`. Mismatch → 409.
- **BR-ACC-001**: no PUT/PATCH on JournalEntry at all (UI hides edit affordance entirely after submit).
- **BR-ACC-003**: sum(debit) must equal sum(credit) on JournalEntry (UI shows live balance check).
- **BR-SAL-002** style: a SalesOrder must have at least one line (`min_length=1` on the lines list).
- **BD-001**: `allow_negative_stock` defaults to false on Warehouse.

### Auth flow
1. `POST /security/auth/login` with `OAuth2PasswordRequestForm` (URL-encoded)
2. Backend returns `{ access_token, token_type: "bearer" }`
3. Frontend stores in `localStorage` as `erplite_token`
4. Every subsequent request: `Authorization: Bearer <token>`
5. On 401: frontend clears token + redirects to `/login`
6. JWT carries `sub` (username), `company_ids`, `tenant_id` — RLS scoped from this

---

## 5. Database Summary

Source of truth: `/home/z/my-project/sql/` (Phase 1/2/3 migrations + RLS + seed).

### Schema highlights
- **Company-scoped tables** (RLS-protected): `sales.customer`, `purchasing.supplier`, `inventory.item`, `inventory.warehouse`, `inventory.item_category`, `sales.sales_order` + lines, `purchasing.purchase_order` + lines, `accounting.account`, `accounting.journal_entry` + lines
- **Global reference tables** (no RLS): `core_org.currency`, `core_org.country`, `core_org.unit_of_measure`, `core_org.company`, `core_org.branch`, `core_org.fiscal_year`
- **Security tables** (NOT RLS-protected — they ARE the source of RLS context): `security.app_user`, `security.user_company_access`
- **Reporting views** (Phase 2 SQL, mostly NOT exposed via HTTP):
  - `reporting.v_stock_balance` ✅ exposed via `GET /inventory/stock-balance`
  - `reporting.v_customer_outstanding` ❌ not exposed
  - `reporting.v_supplier_outstanding` ❌ not exposed
  - `reporting.v_trial_balance` ❌ not exposed

### Identity strategy (ERP-003 Part 5 §1)
- Every API contract uses `uuid` only — never the internal `BIGINT id`
- Frontend types mirror this (no `id` field anywhere)

---

## 6. Completed Screens

(See `docs/FRONTEND_STATUS.md` for the full table.)

**32 routes** total. Every screen is wired to a real backend endpoint OR
shows a clear "غير متاح حالياً" panel referencing `BACKEND_REQUIRED.md`.

Highlights of this pass:
- **ItemDetailPage** (NEW) — uses `GET /inventory/items/{uuid}`
- **ReferenceDataPage + 3 read-only pages** (NEW) — currencies / countries / UoMs
- **All list pages** — search + status filter + count summary + clickable rows
- **All detail pages** — UUIDs resolved to names (customer/item/supplier/account)
- **All forms** — RHF + Zod + Toast + design-system primitives
- **All sensitive actions** — ConfirmDialog before submit
- **All detail pages** — Print button + print CSS
- **Dashboard** — clickable KPI cards + status breakdowns in subtitles

---

## 7. Completed Components

See §3 above for the full list. New in this pass:
- `Toast.tsx` + `toast-state.ts` (ToastProvider + useToast)
- `BooleanBadge.tsx`
- `Skeleton.tsx`
- `DetailField.tsx`
- `FilterBar.tsx`
- `CountSummary.tsx`
- `AccountAutocomplete.tsx`

---

## 8. API Endpoints Used (the 18 the frontend actually calls)

See `docs/FRONTEND_STATUS.md` §"Backend Dependencies" for the full table.

The frontend NEVER calls an endpoint that doesn't exist. Every endpoint is
verified against `app/modules/<x>/router.py` before being wired up.

---

## 9. Remaining Screens

(See `docs/FRONTEND_STATUS.md` §"Remaining" for the full list.)

**Backend-blocked** (will require backend work — see `BACKEND_REQUIRED.md`):
- Trial Balance (HIGH — view exists, endpoint missing)
- Dashboard financial KPIs (HIGH)
- 8 reporting endpoints (MEDIUM)
- Users list/edit (MEDIUM — security-sensitive)
- Roles/Permissions (MEDIUM)
- Company/Branch management (LOW)
- Supplier edit / Item edit (LOW)
- Sales/Purchase Invoices, Purchase Receipts, Stock Movements (full new modules)

**Frontend-only polish** (no backend changes needed):
- Lazy-load routes (cut bundle size)
- Skeleton loaders
- Column sort on list tables
- Keyboard navigation in autocompletes
- Persist filter state in URL

---

## 10. Known Bugs

None known at end of this pass.

(See `docs/FRONTEND_STATUS.md` §"Known Issues" for non-bug limitations.)

---

## 11. Technical Debt

1. **Bundle size** — 525 KB main / 150 KB gzip. Lazy-loading would help.
2. **Client-side filtering on most lists** — works at typical per-company volumes, not scalable.
3. **No tests** — no unit or E2E test files exist. The `tests/` folder is for the backend.
4. **No CI** — no GitHub Actions / similar. Lint + tsc + build run manually.
5. **No env-var validation** — `VITE_API_BASE_URL` is read but not validated.
6. **AuthContext stores token in localStorage** — fine for an internal ERP tool but vulnerable to XSS. HttpOnly cookies would be more secure (requires backend change).
7. **No role-based UI hiding** — the frontend shows all nav items to all authenticated users. The backend enforces RLS, so unauthorized data is never returned, but a polish pass could hide nav items the user can't actually use.

---

## 12. Recommended Next Tasks (priority order)

### P0 — Validate against a running backend
1. Start PostgreSQL (with seed data)
2. Start FastAPI: `cd erplite-backend && uvicorn app.main:app --reload`
3. Start frontend: `cd erplite-frontend && npm run dev`
4. Login + run the smoke test in `docs/FRONTEND_STATUS.md`

### P1 — Close HIGH-priority backend gaps
Per `BACKEND_REQUIRED.md`:
1. `GET /api/v1/reporting/dashboard-summary`
2. `GET /api/v1/accounting/trial-balance`
3. Wire (or remove) the 4 unpersisted DTO fields

### P2 — Close MEDIUM-priority backend gaps
1. Add `?search=` + pagination to list endpoints (coordinated frontend change)
2. Add `GET /security/users` + `PATCH /security/users/{uuid}`
3. Add `PATCH /purchasing/suppliers/{uuid}`
4. **Security**: lock down `POST /security/users` + `POST /core/companies` (bootstrap gap)

### P3 — Frontend polish (no backend changes)
1. Lazy-load route components
2. Skeleton loaders
3. Column sort
4. Keyboard nav in autocompletes
5. URL-persisted filter state

### P4 — New modules (require full backend work)
- HR / Payroll / Manufacturing / CRM / POS / Fixed Assets / e-Invoicing
- Sales/Purchase Invoices, Purchase Receipts
- Stock Movements / Adjustment / Transfer
- Customer/Supplier statements
- General Ledger / Cash/Bank / Financial reports

---

## 13. Commands to Run the Project

```bash
# Frontend (this project)
cd /home/z/my-project/erplite-frontend
npm install            # first time only
npm run dev            # dev server on http://localhost:5173
npm run build          # production build → dist/
npm run preview        # serve the production build
npm run lint           # oxlint
npx tsc --noEmit       # type-check (no output = pass)

# Backend (source of truth — DO NOT modify in this pass)
cd /home/z/my-project/erplite-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# OpenAPI docs: http://localhost:8000/docs
```

### Database (one-time setup)
```bash
# Assuming PostgreSQL 16 is installed and running
cd /home/z/my-project/sql
# Run the migration scripts in order: 001, 002, 003, ... (file names will guide you)
# Then seed: ERP-Lite-005-SeedData-RLS.sql
```

---

## 14. Environment Variables Required

### Frontend (Vite — must be prefixed `VITE_`)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API base URL |

That's the only one. Set in `.env` (gitignored) or shell environment.

### Backend (FastAPI — prefix `ERPLITE_`)
Per `erplite-backend/app/core/config.py`:
| Variable | Default | Purpose |
|---|---|---|
| `ERPLITE_DATABASE_URL` | `postgresql+asyncpg://erplite_app:CHANGE_ME@localhost:5432/erplite` | App DB role (NOBYPASSRLS) |
| `ERPLITE_BOOTSTRAP_DATABASE_URL` | `postgresql+asyncpg://erplite_bootstrap:CHANGE_ME@localhost:5432/erplite` | Bootstrap DB role (BYPASSRLS) — for first-user/first-company only |
| `ERPLITE_JWT_SECRET_KEY` | `CHANGE_ME_IN_PRODUCTION` | JWT signing key |
| `ERPLITE_JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ERPLITE_JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token TTL |
| `ERPLITE_DEFAULT_TENANT_ID` | `1` | Reserved (multi-tenant not yet activated) |
| `ERPLITE_API_V1_PREFIX` | `/api/v1` | URL prefix |
| `ERPLITE_ENVIRONMENT` | `development` | Environment label |

> **Never** commit real secrets. The frontend should NEVER see DB credentials
> or JWT secret — only the API URL.

---

## 15. Architectural Decisions Made During This Pass

### AD-1: Toast system over inline-only errors
**Decision**: Added a `ToastProvider` + `useToast` system on top of the
existing inline error states.

**Why**: Inline errors are good for form validation but the user has to be
looking at the form to see them. Toasts give global feedback for async
operations (create success, submit success, network error). Both coexist.

### AD-2: Read-only reference data pages
**Decision**: Created `/settings/reference/{currencies,countries,units-of-measure}`
as read-only list pages with search, but no create/edit.

**Why**: The backend exposes only `GET` endpoints for these tables (they're
seeded via SQL migrations). Exposing fake create/edit UI would violate
"NO API = NO FEATURE". Showing them as read-only at least lets users
discover what currencies/UoMs exist without digging into SQL.

### AD-3: Resolve UUIDs to names in detail pages
**Decision**: SalesOrderDetailPage / PurchaseOrderDetailPage now fetch
the customer/supplier + items list in parallel to resolve UUIDs to names.

**Why**: Showing `customer.uuid` in the UI is hostile to users. The
alternative — adding `customer_name` to the backend DTO — is preferable
(documented in `BACKEND_REQUIRED.md` §4) but requires backend work. The
frontend workaround uses already-cached list data (TanStack Query reuses
the cache), so it's effectively free.

### AD-4: Print CSS via simple `@media print` rules
**Decision**: Added print styles in `index.css` (hide `aside`, `header`,
`button`, reset main padding, force color-adjust). No PDF library.

**Why**: Most users print to physical paper or to PDF via the browser's
native dialog. A full PDF library (jsPDF, pdfmake) would add ~100KB to the
bundle for a feature most users won't use. The native print path is
sufficient for ERP-Lite's needs.

### AD-5: AccountAutocomplete over bare `<select>` in JE form
**Decision**: Built a dedicated `AccountAutocomplete` component (searchable,
client-side filtered, group accounts excluded per BR-ACC-002).

**Why**: A typical chart of accounts has 50-200 leaf accounts. A bare
`<select>` makes finding the right one painful. The autocomplete is also
reusable in future screens (account ledger, trial balance drill-down).

### AD-6: Keep forms inline for Accounts/Categories/Warehouses
**Decision**: AccountsPage / ItemCategoriesPage / WarehousesPage keep the
inline create form on the same page as the list (split 2/3 + 1/3).

**Why**: These entities have very few fields (1-4 inputs) and users typically
add several at once. A dedicated form page would be more clicks for no
benefit. The Customer/Supplier/Item forms, in contrast, have more fields
and benefit from a dedicated page.

### AD-7: No lazy loading (yet)
**Decision**: All routes are eager-imported in `App.tsx`.

**Why**: The bundle is 525 KB / 150 KB gzip — above Vite's warning threshold
but acceptable for an internal ERP. Lazy loading would cut the main chunk
but complicate the route table slightly. Listed as P3 in the next-tasks
list — easy to do later without architectural change.

### AD-8: Clickable rows on list pages
**Decision**: All list tables now have `cursor: pointer` + `onClick={() =>
navigate('/.../:uuid')}` on each row.

**Why**: ERP users expect to click a row to see details. The previous
"عرض" link in the last column was redundant with row click. Removed the
link column and made the whole row clickable — cleaner + more clickable
surface area on mobile.

---

## DO NOT TOUCH

These rules are non-negotiable. If you break them, you'll undo work that
was carefully considered:

1. **Don't change the backend** unless you've documented the change in
   `BACKEND_REQUIRED.md` AND verified it doesn't break RLS / optimistic
   locking / business rules. The backend is the source of truth.
2. **Don't replace the design system.** Tailwind + the primitives in
   `components/ui/` are intentional. Adding a UI library (MUI, Ant, Chakra)
   would bloat the bundle and break the consistent look.
3. **Don't introduce fake data.** If an endpoint doesn't exist, show
   "غير متاح حالياً" and document in `BACKEND_REQUIRED.md`. This is the
   project's golden rule.
4. **Don't put JWT / DB credentials / API secrets in the frontend.** Only
   `VITE_API_BASE_URL` belongs in the frontend env.
5. **Don't disable the optimistic-locking 409 handler.** It's there for
   a reason — concurrent edits. On 409, refetch + show Arabic notice.
6. **Don't add PUT/PATCH on JournalEntry.** BR-ACC-001 is enforced by
   backend omission; the frontend mirrors by hiding the edit affordance
   entirely after submit.
7. **Don't break the `react/only-export-components` lint rule.** If you
   need to export a non-component from a file that also exports a
   component, split the non-component into a sibling `-state.ts` file
   (see `auth/AuthContext.tsx` + `auth/auth-state.ts` and
   `components/ui/Toast.tsx` + `components/ui/toast-state.ts`).
8. **Don't rename the API functions or TypeScript interfaces.** They
   mirror the backend Pydantic schemas 1:1. Renaming breaks the contract.
9. **Don't add a state management library (Redux, Zustand, MobX).** TanStack
   Query handles server state. Local UI state is fine in `useState`. If you
   need cross-page state, use the URL (search params) — that's what it's for.
10. **Don't add a date/time library (moment, dayjs, date-fns) unless
    absolutely necessary.** `new Date().toISOString().slice(0, 10)` works
    fine for the simple date inputs we use. If you need formatting, prefer
    `Intl.DateTimeFormat('ar-EG')`.

---

## Final Commands (run before declaring done)

```bash
cd /home/z/my-project/erplite-frontend
npm run lint           # MUST pass with 0 warnings, 0 errors
npx tsc --noEmit       # MUST pass with 0 errors
npm run build          # MUST succeed
```

If any of these fail, fix the issue before handing off. The current state
at the time of this writing: all three pass.

---

## Handoff complete.

Pick up at `docs/FRONTEND_STATUS.md` §"Next Recommended Tasks" — P0 (validate
against running backend) is the obvious first move.
