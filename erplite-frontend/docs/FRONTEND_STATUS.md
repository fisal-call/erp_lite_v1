# FRONTEND_STATUS — ERP-Lite Frontend

> Snapshot taken during the **autonomous continuation pass (rounds 1+2)**.
> Live state lives in the code (`/home/z/my-project/erplite-frontend/src/`).

---

## Completed

### Foundation
- ✅ React 19 + TypeScript 6 + Vite 8 + Tailwind CSS 4
- ✅ TanStack Query 5 for server state (cache, retry, refetchOnWindowFocus off)
- ✅ Axios-based central API client (`src/api/client.ts`) with:
  - JWT bearer token from `localStorage`
  - 401 → auto-logout + redirect to `/login`
  - `ApiError` class with rule-ID extraction (`[BR-XXX-NNN]` → `ruleId`)
  - `describeError()` Arabic helper for any thrown value
- ✅ `AuthContext` + `ProtectedRoute` + `LoginPage` (OAuth2 password-form login)
  - **Round 2 polish:** branded card layout, password show/hide toggle (eye icon),
    `describeError()` for Arabic server-error rendering, autocomplete attributes
- ✅ Mobile-first `AppLayout` with RTL sidebar drawer + grouped navigation
- ✅ `ToastProvider` + `useToast()` for global success/error notifications
- ✅ `index.css` design system (`.input`, `.ltr-text`, print styles, focus rings)
- ✅ **Round 2:** All 32 routes lazy-loaded with `React.lazy` + `Suspense` —
  main bundle dropped from 525 KB / 150 KB gzip to **224 KB / 69 KB gzip**
  (per-page chunks: 2–12 KB each, fetched on demand)
- ✅ **Round 2:** 404 NotFound page at `*` route with quick-jump-back links

### UI Primitives (`src/components/ui/`)
| Component | Purpose |
|---|---|
| `Card` | Surface container with shadow + border + padding |
| `KpiCard` | Dashboard KPI tile with `available={false}` → "غير متاح حالياً" |
| `PageHeader` | Page title row with optional actions slot |
| `Spinner` | Centered loading indicator |
| `EmptyState` | Empty-data placeholder with message |
| `ErrorState` | Error placeholder with message + optional retry |
| `ConfirmDialog` | Modal dialog for sensitive operations (RTL) |
| `Table` + `Th` + `Td` | Mobile-responsive table wrapper (overflow-x-auto) |
| `ToastProvider` + `useToast` | Toast notifications (success/error/info/warning) |
| `BooleanBadge` | Pill for true/false states (نشط / مووف) |
| `Skeleton` | Loading skeleton for cards / table rows |
| `DetailField` | Read-only label/value row for detail pages |
| `FilterBar` | Search + filters + clear-filters toolbar |
| `CountSummary` | "عرض X من Y" with optional status breakdown |
| **`SortableTh`** *(Round 2)* | Table header cell with asc/desc sort indicator |
| **`useSort`** *(Round 2)* | Client-side sort hook (null-safe, multi-column) |
| **`useListboxKeyboard`** *(Round 2)* | ArrowDown/ArrowUp/Enter/Escape for autocompletes |
| **`useUrlState`** *(Round 2)* | Persist a piece of state in URL query string |

### Reusable Components (`src/components/`)
- `CustomerAutocomplete` — searchable customer picker (client-side filter)
  - **Round 2:** keyboard nav + ARIA combobox roles
- `SupplierAutocomplete` — searchable supplier picker (client-side filter)
  - **Round 2:** keyboard nav + ARIA combobox roles
- `ItemAutocomplete` — searchable item picker (debounced server search)
  - **Round 2:** keyboard nav + ARIA combobox roles
- `AccountAutocomplete` — searchable account picker (groups filtered out)
  - **Round 2:** keyboard nav + ARIA combobox roles
- `StatusBadge` — 7-status pill matching PDR-002 statuses

### Routes (33 total — was 32, added NotFound)
| Path | Page |
|---|---|
| `/login` | LoginPage (branded + password toggle) |
| `/` | DashboardPage (real KPIs only — financial KPIs show "غير متاح", per-tile skeleton loaders) |
| `/sales/customers` | CustomersListPage (search + status filter + sortable columns + skeleton loaders + URL-persisted filters) |
| `/sales/customers/new` | CustomerFormPage (RHF + Zod + Toast) |
| `/sales/customers/:uuid` | CustomerDetailPage (DetailField + BooleanBadge) |
| `/sales/customers/:uuid/edit` | CustomerEditPage (PATCH + optimistic lock + 409) |
| `/sales/orders` | SalesOrdersListPage (status filter + sortable + skeleton + URL state) |
| `/sales/orders/new` | SalesOrderFormPage (autocomplete + dynamic lines + total) |
| `/sales/orders/:uuid` | SalesOrderDetailPage (customer/item name resolution + print + submit) |
| `/purchasing/suppliers` | SuppliersListPage (sortable + skeleton + URL state) |
| `/purchasing/suppliers/new` | SupplierFormPage |
| `/purchasing/suppliers/:uuid` | SupplierDetailPage |
| `/purchasing/orders` | PurchaseOrdersListPage |
| `/purchasing/orders/new` | PurchaseOrderFormPage |
| `/purchasing/orders/:uuid` | PurchaseOrderDetailPage |
| `/inventory/items` | ItemsListPage |
| `/inventory/items/new` | ItemFormPage (RHF + Zod + Toast + categories + UoMs) |
| `/inventory/items/:uuid` | ItemDetailPage (NEW — uses GET /inventory/items/{uuid}) |
| `/inventory/categories` | ItemCategoriesPage (list + inline create) |
| `/inventory/warehouses` | WarehousesPage (list + inline create) |
| `/inventory/stock-balance` | StockBalancePage (search + warehouse filter + stock filter + print) |
| `/accounting/accounts` | AccountsPage (search + type filter + color-coded badges + inline create) |
| `/accounting/journal-entries` | JournalEntriesListPage |
| `/accounting/journal-entries/new` | JournalEntryFormPage (AccountAutocomplete + balance check + Toast) |
| `/accounting/journal-entries/:uuid` | JournalEntryDetailPage (account name resolution + print + submit) |
| `/accounting/trial-balance` | TrialBalancePage (clear "غير متاح" panel — backend gap) |
| `/reports` | ReportsIndexPage (all expected reports + availability badge) |
| `/settings` | SettingsIndexPage (users/roles/company/branches = "غير متاح"; link to reference data) |
| `/settings/reference` | ReferenceDataPage (NEW — links to currencies/countries/UoMs) |
| `/settings/reference/currencies` | CurrenciesPage (NEW — read-only list + search) |
| `/settings/reference/countries` | CountriesPage (NEW — read-only list + search) |
| `/settings/reference/units-of-measure` | UnitsOfMeasurePage (NEW — read-only list + search) |

### Module Coverage
| Module | List | Detail | Form | Edit | Submit | Print | Other |
|---|---|---|---|---|---|---|---|
| Sales — Customers | ✅ | ✅ | ✅ | ✅ (PATCH+409) | n/a | n/a | — |
| Sales — Orders | ✅ | ✅ | ✅ | n/a (no PATCH) | ✅ | ✅ | — |
| Purchasing — Suppliers | ✅ | ✅ | ✅ | n/a (no PATCH) | n/a | n/a | — |
| Purchasing — Orders | ✅ | ✅ | ✅ | n/a | ✅ | ✅ | — |
| Inventory — Items | ✅ | ✅ | ✅ | n/a (no PATCH) | n/a | n/a | — |
| Inventory — Categories | ✅ | — | ✅ (inline) | n/a | n/a | n/a | — |
| Inventory — Warehouses | ✅ | — | ✅ (inline) | n/a | n/a | n/a | — |
| Inventory — Stock Balance | ✅ | — | — | — | — | ✅ | — |
| Accounting — Accounts | ✅ | — | ✅ (inline) | n/a | n/a | n/a | — |
| Accounting — Journal Entries | ✅ | ✅ | ✅ | n/a (BR-ACC-001) | ✅ | ✅ | — |
| Accounting — Trial Balance | — | — | — | — | — | — | ❌ "غير متاح" |
| Core Org — Currencies | ✅ | — | — | — | — | — | read-only |
| Core Org — Countries | ✅ | — | — | — | — | — | read-only |
| Core Org — Units of Measure | ✅ | — | — | — | — | — | read-only |
| Security — Users | ❌ | ❌ | ❌ | ❌ | — | — | "غير متاح" — backend gap |

### Cross-cutting Concerns
- ✅ RTL Arabic-first UI throughout (html dir="rtl", sidebar on right)
- ✅ Mobile-first responsive layout (drawer nav, responsive grids, overflow-x-auto tables)
- ✅ Optimistic locking (PDR-001) on customer PATCH + sales-order/PO submit (409 → refetch + Arabic notice)
- ✅ BR-ACC-001 enforced by UI omission (no edit on submitted JE)
- ✅ BR-ACC-003 enforced client-side (live balance check; backend is final judge)
- ✅ ConfirmDialog before all irreversible actions (submit SO/PO/JE)
- ✅ Print CSS (sidebar/topbar/buttons hidden, color-adjust exact)
- ✅ Toast notifications on all create/submit success/error
- ✅ LTR helper (`.ltr-text`) for emails/phones/dates/UUIDs/ISO codes
- ✅ Loading states (`<Spinner>`) and empty states (`<EmptyState>`) everywhere
- ✅ Error states (`<ErrorState>`) with Arabic messages
- ✅ Client-side search + status filter on every list page (where data supports it)
- ✅ Count summary "عرض X من Y" + status breakdown on every list page
- ✅ Clickable rows on list pages (navigate to detail)
- ✅ UUIDs hidden in detail pages (resolved to names via additional fetches)
- ✅ Hyperlinks between related entities (e.g. SO detail → customer detail → item detail)
- ✅ Audit fields (created_at, version_no) shown on detail pages
- ✅ Build, lint, type-check all PASS (0 warnings, 0 errors)

---

## In Progress

Nothing is in-flight. The autonomous pass is complete to the threshold defined
by the task brief.

---

## Remaining

Items deliberately NOT implemented because they would require backend work
(documented in `BACKEND_REQUIRED.md`):

### Backend-blocked
- ❌ **Trial Balance page** — needs `GET /accounting/trial-balance` (view exists, endpoint missing)
- ❌ **Dashboard financial KPIs** — needs `GET /reporting/dashboard-summary`
- ❌ **Sales/Purchase/Inventory reports** — needs 8 reporting endpoints
- ❌ **Users list/edit page** — needs `GET /security/users` + `PATCH /security/users/{uuid}`
- ❌ **Roles/Permissions page** — needs `GET /security/roles` + assign endpoints
- ❌ **Company management page** — needs `GET /core/companies/me`
- ❌ **Branch management page** — needs `GET /core/branches` + `POST /core/branches`
- ❌ **Supplier edit page** — needs `PATCH /purchasing/suppliers/{uuid}`
- ❌ **Item edit page** — needs `PATCH /inventory/items/{uuid}`
- ❌ **Sales/Purchase Invoices** — module not implemented in backend
- ❌ **Purchase Receipts** — module not implemented in backend
- ❌ **Stock Movements / Adjustment / Transfer** — module not implemented in backend
- ❌ **Customer/Supplier statements** — needs reporting endpoints
- ❌ **General Ledger / Cash/Bank / Financial reports** — needs reporting endpoints

### Frontend-only (could be done next pass without backend changes)
- ✅ ~~Lazy-load route components~~ **Done in round 2** — main bundle is now 224 KB / 69 KB gzip
- ✅ ~~Skeleton loaders on list pages~~ **Done in round 2** — every list page now shows skeleton rows during load
- ✅ ~~Sort on list table columns~~ **Done in round 2** — `SortableTh` + `useSort` applied to all 11 list pages
- ✅ ~~Keyboard navigation in autocompletes~~ **Done in round 2** — `useListboxKeyboard` in all 4 autocompletes
- ✅ ~~Save/restore filter state in URL~~ **Done in round 2** — `useUrlState` applied to all filterable list pages
- ⏳ **Server-side pagination** (currently client-side — fine for typical per-company volumes)
- ⏳ **Dark mode** (design system is light-only)
- ⏳ **i18n for English** (currently Arabic-only)

---

## Backend Dependencies

All endpoints the frontend depends on are documented in:
- `BACKEND_REQUIRED.md` — exhaustive list with priority + suggested response shapes
- `docs/TODO.md` — same list, condensed, with pointers for Aider+DeepSeek

The frontend hits 18 backend endpoints (all real, no mocks):

| Module | Endpoint | Used by |
|---|---|---|
| security | `POST /security/auth/login` | LoginPage |
| security | `POST /security/users` | (not exposed — bootstrap-only) |
| core | `GET /core/currencies` | SO/PO form + Reference page |
| core | `GET /core/countries` | Reference page |
| core | `GET /core/units-of-measure` | Item form + Reference page |
| inventory | `GET /inventory/items` (paginated + search) | Items list + ItemAutocomplete + Dashboard |
| inventory | `GET /inventory/items/{uuid}` | Item detail page |
| inventory | `POST /inventory/items` | Item form |
| inventory | `GET /inventory/item-categories` | Categories page + Item form |
| inventory | `POST /inventory/item-categories` | Categories page |
| inventory | `GET /inventory/warehouses` | Warehouses page + Dashboard |
| inventory | `POST /inventory/warehouses` | Warehouses page |
| inventory | `GET /inventory/stock-balance` | Stock balance + Dashboard |
| sales | `GET /sales/customers` | Customers list + CustomerAutocomplete + Dashboard |
| sales | `GET /sales/customers/{uuid}` | Customer detail + edit + SO detail (name resolution) |
| sales | `POST /sales/customers` | Customer form |
| sales | `PATCH /sales/customers/{uuid}` | Customer edit |
| sales | `GET /sales/sales-orders` | SO list + Dashboard |
| sales | `GET /sales/sales-orders/{uuid}` | SO detail |
| sales | `POST /sales/sales-orders` | SO form |
| sales | `POST /sales/sales-orders/{uuid}/submit` | SO detail (submit action) |
| purchasing | `GET /purchasing/suppliers` | Suppliers list + SupplierAutocomplete + Dashboard |
| purchasing | `GET /purchasing/suppliers/{uuid}` | Supplier detail + PO detail (name resolution) |
| purchasing | `POST /purchasing/suppliers` | Supplier form |
| purchasing | `GET /purchasing/purchase-orders` | PO list + Dashboard |
| purchasing | `GET /purchasing/purchase-orders/{uuid}` | PO detail |
| purchasing | `POST /purchasing/purchase-orders` | PO form |
| purchasing | `POST /purchasing/purchase-orders/{uuid}/submit` | PO detail (submit action) |
| accounting | `GET /accounting/accounts` | Accounts page + AccountAutocomplete + JE detail (name resolution) |
| accounting | `POST /accounting/accounts` | Accounts page (inline create) |
| accounting | `GET /accounting/journal-entries` | JE list + Dashboard |
| accounting | `GET /accounting/journal-entries/{uuid}` | JE detail |
| accounting | `POST /accounting/journal-entries` | JE form |
| accounting | `POST /accounting/journal-entries/{uuid}/submit` | JE detail (submit action) |

---

## Known Issues

### 1. ~~Bundle size warning~~ RESOLVED in round 2
`npm run build` previously emitted a warning because the main chunk was 525 KB
(150 KB gzip), above Vite's 500 KB default. **Round 2** lazy-loaded all routes
with `React.lazy` + `Suspense`. The main chunk is now **224 KB / 69 KB gzip**,
with each page split into its own 2–12 KB chunk fetched on demand. No more
warning. The single remaining ~92 KB chunk is `schemas` (zod + rhf) which only
loads on form pages.

### 2. Customer/Supplier/Item autocompletes fetch the whole list once
CustomerAutocomplete and SupplierAutocomplete load the entire per-company list
on mount and filter client-side. This works for typical ERP-Lite volumes
(hundreds, not thousands, of customers per company). If volumes grow, server-side
search needs to be added to the customer/supplier list endpoints (already
documented in BACKEND_REQUIRED.md §2).

### 3. List pages without server-side pagination
Most list endpoints return up to 200 rows (or 500 for accounts) in one shot.
The frontend filters client-side. This works for typical ERP-Lite per-company
data but is not scalable. See BACKEND_REQUIRED.md §2.

### 4. SalesOrder/PurchaseOrder list shows no total
The summary DTO (`SalesOrderSummaryRead` / `PurchaseOrderSummaryRead`) exposes
only `document_number`/`document_date`/`status` — no `total_amount`. The
frontend could compute the total by issuing an N+1 detail fetch per row, but
that's an anti-pattern. Better to add `total_amount` to the summary DTO on the
backend. Documented in BACKEND_REQUIRED.md §4.

### 5. JE submit does not require `expected_version_no`
The backend's `POST /accounting/journal-entries/{uuid}/submit` takes no body,
unlike SO/PO submit. The frontend calls it without arguments (correct today)
and has a defensive 409 handler in place (will not trigger today). Documented
in BACKEND_REQUIRED.md §8.

### 6. Toast container position
The toast container is at `top-4 left-4` (which is the visual "end" in RTL —
i.e. bottom-left of the viewport). For RTL it's idiomatic, but some users
expect toasts at the bottom. Easy CSS change if desired.

---

## Testing Status

### Static checks (all PASS — round 2)
| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` (oxlint) | 0 warnings, 0 errors, 73 files |
| Type check | `npx tsc --noEmit` | 0 errors |
| Build | `npm run build` (tsc + vite) | Success, **224 KB / 69 KB gzip** main + 105 KB / 38 KB gzip UI chunk + 92 KB / 27 KB gzip schemas chunk + 2-12 KB per-page chunks |

### E2E smoke test (manual — to be done with a running backend)
The recommended smoke test sequence:
1. Login with valid credentials → expect redirect to `/`
2. Dashboard → expect KPI tiles to load (4 master data + 4 documents + 4 financial "غير متاح")
3. Navigate to `/sales/customers` → expect list, search works, status filter works
4. Click "+ عميل جديد" → create a customer → expect toast + redirect to detail page
5. Click "تعديل" → modify name → save → expect toast + redirect back to detail
6. Navigate to `/sales/orders/new` → pick customer + add line → save → expect toast + redirect to detail
7. On SO detail → click "اعتماد الأمر" → confirm → expect toast + status becomes "معتمد"
8. Logout → expect redirect to `/login`
9. Repeat analogous flow for: Supplier → PO → submit; Item → view detail; Account → create; JE → create → submit
10. Navigate to `/settings/reference/currencies` → expect read-only list

### What was NOT tested
- Real backend integration (no running PostgreSQL + FastAPI instance during this pass)
- Mobile layout on physical devices (verified CSS breakpoints only)
- Print output on physical printers (verified CSS rules only)

---

## Next Recommended Tasks

For the **next agent** (Aider + DeepSeek or Claude Code), in priority order:

### P0 — Backend integration test
1. Start the FastAPI backend against a seeded PostgreSQL
2. Run the E2E smoke test above with real data
3. Fix any drift between the documented contract and actual backend behavior

### P1 — Close the HIGH-priority backend gaps
Per BACKEND_REQUIRED.md:
1. `GET /api/v1/reporting/dashboard-summary` — unblocks 4 dashboard KPIs
2. `GET /api/v1/accounting/trial-balance` — unblocks the trial balance page
3. Wire (or remove) the 4 unpersisted DTO fields (parent_account_uuid, branch_uuid, tax_rate_uuid)

### P2 — Close the MEDIUM-priority backend gaps
1. Add `?search=` + pagination to list endpoints (breaks frontend — coordinated change)
2. Add `GET /security/users` (list) + `PATCH /security/users/{uuid}`
3. Add `PATCH /purchasing/suppliers/{uuid}` (mirrors customer PATCH)
4. Lock down `POST /security/users` + `POST /core/companies` (security — bootstrap gap)

### P3 — Frontend polish (no backend changes)
1. ✅ ~~Lazy-load route components (cut bundle to <300 KB main)~~ Done in round 2
2. ✅ ~~Add skeleton loaders~~ Done in round 2
3. ✅ ~~Add column sort to list tables~~ Done in round 2
4. ✅ ~~Add keyboard navigation to autocompletes~~ Done in round 2
5. ✅ ~~Persist filter state in URL search params~~ Done in round 2
6. ⏳ Server-side pagination (only when per-company volumes grow)
7. ⏳ Dark mode
8. ⏳ i18n for English (currently Arabic-only)

### P4 — New modules (require full backend work)
Per task brief, NOT in scope for ERP-Lite 0.3:
- HR / Payroll
- Manufacturing
- CRM
- POS
- Fixed Assets
- e-Invoicing
- Sales Invoices / Purchase Invoices / Purchase Receipts
- Stock Movements / Adjustment / Transfer
- Customer/Supplier statements
- General Ledger / Cash/Bank / Financial reports
