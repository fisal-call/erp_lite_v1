# DECISIONS_PENDING — ERP-Lite Frontend

> Business / architecture decisions that need human review but were NOT
> blocking during the autonomous pass. Each one lists the options I
> considered, what I picked by default, and why a human might override.

During this pass I implemented everything I could without making
debateable business decisions. Where a real choice had to be made, I
picked the most conservative option and documented it here.

---

## Decision 1 — Should the frontend offer a "create user" UI today?

**Context**: The backend exposes `POST /security/users` but it's
deliberately unauthenticated (bootstrap gap, see
`docs/BACKEND_ISSUES.md` Issue 5). The Settings page currently shows
"غير متاح حالياً" for users.

**Options**:
- (A) Show a "Create user" form on the Settings page, calling the
      existing unauthenticated endpoint. Easy but ships an insecure UI.
- (B) Wait until the backend locks down the endpoint (admin-only guard)
      before exposing any user-management UI. Safe but blocks user
      creation in the meantime.
- (C) Show the form but display a clear warning that the endpoint is
      unauthenticated and should not be used in production yet.

**Default picked**: (B) — Settings page shows "غير متاح". The endpoint
existing in the backend is not enough; we wait for the security guard
before surfacing it.

**Why a human might override**: If you're running ERP-Lite in a trusted
internal network and need to bootstrap users via the UI, option (A) or
(C) might be acceptable. Make the choice explicit.

---

## Decision 2 — Should the Trial Balance page try to compute client-side?

**Context**: The view `reporting.v_trial_balance` exists in the DB but is
not exposed via HTTP. The frontend has all the journal-entry data needed
to compute a trial balance client-side (account UUIDs + debit/credit
amounts per line).

**Options**:
- (A) Compute the trial balance client-side by fetching all journal
      entries + all accounts and aggregating in JS. Hacky but unblocks
      the page today.
- (B) Wait for the backend endpoint (recommended). The view exists, the
      endpoint is a 30-line addition. Doing it client-side risks
      producing numbers that disagree with the backend's authoritative
      computation.

**Default picked**: (B) — page shows "غير متاح حالياً" with a pointer
to `BACKEND_REQUIRED.md`. This respects "the backend is the source of
truth" — accounting numbers especially.

**Why a human might override**: If users desperately need a quick trial
balance and the backend work isn't scheduled soon, option (A) is
defensible — but the page MUST clearly say "قيمة تجريبية محسوبة من
الواجهة — قد تختلف عن التقرير الرسمي" so users don't trust it for
audits.

---

## Decision 3 — Should the dashboard's "low stock" threshold be configurable?

**Context**: The dashboard's stock KPI shows "X صنف برصيد صفر أو سالب"
as the "low stock" indicator. The threshold is hardcoded to `<= 0`.

**Options**:
- (A) Hardcode threshold to `<= 0` (current). Simple, no UI.
- (B) Add a "low stock threshold" field per item in the backend, then
      surface it on the dashboard. Requires backend work.
- (C) Add a global "low stock threshold" setting in the frontend
      (localStorage), applied to the dashboard only.

**Default picked**: (A) — `<= 0` is the most defensible definition of
"low" without per-item configuration. Reorder points are a real feature
that deserves its own backend work.

**Why a human might override**: If the business has a standard "reorder
point" concept per item, option (B) is the right answer. Option (C) is
a poor middle ground — global threshold doesn't match reality.

---

## Decision 4 — Should the frontend show JWT-decoded company info?

**Context**: The JWT carries `company_ids` + `tenant_id` + `sub`
(username). The frontend can decode this without a backend round-trip.
The current Settings page shows "غير متاح" for the company info.

**Options**:
- (A) Decode the JWT client-side and display `company_ids[0]` (or
      similar) as the "current company". Fast, no API call. BUT exposes
      internal IDs in the UI and is display-only (RLS still enforced
      server-side).
- (B) Wait for `GET /core/companies/me` backend endpoint (recommended)
      and display the real company name.
- (C) Decode JWT for display, but only show the username (not company_ids
      or tenant_id). Less informative but doesn't leak internal IDs.

**Default picked**: (B) — Settings page shows "غير متاح" for company
info, with a clear pointer to `BACKEND_REQUIRED.md`. Username is the
only JWT-derived data shown (in the topbar, derived in `AuthContext`).

**Why a human might override**: If the topbar needs to show company name
ASAP and `GET /core/companies/me` isn't scheduled, option (C) is a
safe compromise — username only, no internal IDs.

---

## Decision 5 — How to display financial amounts across the UI?

**Context**: Sales orders, purchase orders, and journal entries all carry
Decimal amounts. Currently displayed as plain numbers (`total.toFixed(2)`).

**Options**:
- (A) Plain `toFixed(2)` everywhere. Simple. No currency symbol.
- (B) Use `Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' })`.
      Adds the "ج.م." suffix and Arabic digit grouping. But assumes the
      currency is EGP — the SO/PO form actually lets the user pick any
      currency.
- (C) Pass the order's `currency_uuid` through, resolve to ISO code, and
      format with the correct currency. Requires either a JOIN in the
      backend or a client-side lookup against `/core/currencies`.

**Default picked**: (A) — plain `toFixed(2)`. The detail page already
shows the currency ISO code separately. Combining them properly (option C)
would be ideal but requires either backend changes or non-trivial
frontend plumbing.

**Why a human might override**: For a polished UX, option (C) is the
right answer. Worth doing once the backend exposes `currency_iso_code`
on the document Read DTOs (similar to `created_by_name` in Issue 9).

---

## Decision 6 — Should we lazy-load routes?

**Context**: All 28 routes are eager-imported in `App.tsx`. Bundle is
525 KB / 150 KB gzip.

**Options**:
- (A) Keep eager imports. Simpler. Faster first paint (no Suspense
      boundary needed). Higher initial JS payload.
- (B) Lazy-load every route with `React.lazy` + `Suspense`. Cuts initial
      payload to ~300 KB or less. Adds a Suspense boundary (one extra
      `null`/`<Spinner>` fallback). Code-split per route.
- (C) Lazy-load only the heavy routes (e.g. accounting/journal-entries
      which pulls in AccountAutocomplete + accounts list).

**Default picked**: (A) — eager. The 525 KB bundle is above Vite's
warning threshold but acceptable for an internal ERP tool. Listed as
P3 polish in `docs/TODO.md`.

**Why a human might override**: If users are on slow connections or
mobile data, option (B) is worth the small Suspense complexity. Easy
to do — no architectural change required.

---

## Decision 7 — Should the autocomplete components support keyboard navigation?

**Context**: CustomerAutocomplete, SupplierAutocomplete, ItemAutocomplete,
and AccountAutocomplete all work with mouse + click only. No
ArrowDown/ArrowUp/Enter/Esc handling.

**Options**:
- (A) Mouse only (current). Simpler. Works on desktop. Mobile users
      don't have a keyboard anyway.
- (B) Full ARIA combobox semantics (ArrowDown opens, ArrowUp/Down moves
      highlight, Enter selects, Esc closes, type-ahead).

**Default picked**: (A) — mouse only. Adding full keyboard nav is
non-trivial (highlight index state, focus management, ARIA attributes).
Listed as P3 polish in `docs/TODO.md`.

**Why a human might override**: Accessibility requirements (WCAG) would
push toward option (B). Power users also expect keyboard nav in ERPs.

---

## Decision 8 — Should the frontend support multiple companies per session?

**Context**: The JWT carries `company_ids: list[int]`. The backend's
`_company_id(token)` helper uses `token.company_ids[0]` (the first one)
for write operations. There's no company-selector UI.

**Options**:
- (A) Single-company assumption (current). The frontend ignores
      `company_ids[1:]` entirely. RLS scopes all reads to all the user's
      companies (which can produce cross-company results on lists).
- (B) Add a company-selector dropdown in the topbar. Send the selected
      company as a header on every request. Backend needs a header
      parser to override `_company_id`.

**Default picked**: (A) — single-company. Multi-company is documented in
the backend as "tenant-ready" but not yet activated (AD-001 in backend
config). The frontend mirrors this — no company selector.

**Why a human might override**: If multi-company is being activated,
option (B) requires coordinated frontend + backend work. The backend
header parser is straightforward; the frontend selector + axios
interceptor is also straightforward. Plan it as one PR.

---

## Decision 9 — Cost Centers (مراكز التكلفة)

**Context**: The user requested a Cost Centers module (Phase 8). Cost centers
are organizational units used to allocate expenses and revenues for
management reporting. The ERP-Lite DB schema has NO `cost_center` table —
checked all 7 SQL migration files (ERP-Lite-001 through ERP-Lite-007) and
confirmed zero matches.

**Options**:
- (A) Add a `core.cost_center` table (id, uuid, company_id, code, name,
      parent_id for hierarchy, is_active, is_deleted) + a CRUD endpoint +
      a frontend module. Requires coordinated backend+DB+frontend work.
      Estimated effort: ~2 days.
- (B) Skip cost centers for ERP-LITE — they're more relevant for
      enterprise ERP. Document as future scope.
- (C) Use a "tag" approach: add a `cost_center_tag VARCHAR(50)` column to
      `journal_entry` and group reports by it. Lighter weight but less
      structured.

**Default picked**: (B) — document and defer. ERP-LITE is for small/medium
businesses where cost centers may not be needed. The journal_entry table
already has `custom_fields JSONB` which can carry an optional cost center
label if needed.

**What's needed if pursued**: New table in `core` schema, FK from
`accounting.journal_entry_line.cost_center_id`, RLS policies, CRUD endpoints,
UI for master + hierarchy + assignment in JE form + cost center report.

---

## Decision 10 — Fixed Assets (الأصول الثابتة)

**Context**: The user requested a Fixed Assets module (Phase 9). This
typically includes: asset master, asset categories, acquisition entries,
depreciation schedules (straight-line, declining balance), disposal, asset
register report. The ERP-Lite DB has NO fixed-asset tables — checked all
migrations, no `asset`, `fixed_asset`, `depreciation` matches.

**Options**:
- (A) Build a full Fixed Assets subsystem:
      - `accounting.asset_category` (id, uuid, name, default_life_years,
        depreciation_method, gl_account_id)
      - `accounting.asset` (id, uuid, company_id, code, name, category_id,
        acquisition_date, acquisition_cost, salvage_value, useful_life_months,
        depreciation_method, gl_account_id, accumulated_dep_account_id,
        dep_expense_account_id, status, is_disposed)
      - `accounting.asset_depreciation_entry` (id, asset_id, period, amount,
        journal_entry_id)
      - Endpoints: CRUD for assets + POST /assets/{uuid}/depreciate +
        GET /assets/{uuid}/register
      - Frontend: asset master, category master, depreciation run screen,
        asset register report
      - Estimated effort: ~5 days.
- (B) Skip — use the existing accounting module. Asset purchases go
      through regular journal entries (debit Asset account, credit Cash).
      No depreciation automation. The accountant computes depreciation
      manually and posts a JE each period.
- (C) Build minimal: asset master (CRUD only) + a "depreciation JE helper"
      that suggests a depreciation entry based on (cost - salvage) / life.
      No automation, no asset register view. Estimated: ~2 days.

**Default picked**: (B) — defer. Building a full Fixed Assets subsystem
without committed DB schema would be inventing a major new business system.
The user explicitly said: "لا تخترع نظام Fixed Assets كامل من Frontend."

**What's needed if pursued**: New tables in `accounting` schema, with FKs
to `accounting.account` (for asset / accumulated depreciation / depreciation
expense accounts), RLS policies, depreciation calculation service (with
multiple methods), periodic depreciation run scheduler, disposal workflow
with gain/loss computation, asset register report.

---

## Decision 11 — Expenses Module (المصروفات)

**Context**: The user requested an Expenses module (Phase 7) with expense
categories, expense entry, approval workflow, payment method, cost center.
The ERP-Lite DB has NO `expense` or `expense_category` tables.

**Options**:
- (A) Build a dedicated Expenses subsystem:
      - `accounting.expense_category` (id, uuid, company_id, name,
        default_gl_account_id)
      - `accounting.expense` (id, uuid, company_id, category_id, amount,
        payment_method, payee, expense_date, status, journal_entry_id,
        cost_center_id)
      - Endpoints: CRUD + approval workflow + list + reports
      - Frontend: expense entry form, list, approval queue, expense reports
      - Estimated effort: ~3 days.
- (B) Use the existing Journal Entry flow for expenses. The accountant
      creates a JE with debit to the expense account and credit to cash/bank.
      The "memo" field documents the expense nature. No dedicated UI.
      Status: this is what ERP-Lite currently supports.
- (C) Build a "Quick Expense" UI that's a thin wrapper over
      `POST /accounting/journal-entries`. The user picks an expense account,
      amount, payment method; the UI auto-generates a balanced JE.
      No new tables, no approval workflow. Estimated: ~1 day.

**Default picked**: (B) — defer. The user said: "لا تخترع قيوداً محاسبية
جديدة من Frontend." Building a separate expense system would either
duplicate the JE flow (bad) or wrap it without adding real value.
Option (C) is appealing for UX but should be a separate, scoped feature
after the core is stable.

**What's needed if pursued**: New tables for expense_category + expense
with FK to journal_entry (so each expense auto-creates a balanced JE),
RLS policies, optional approval workflow (with state machine), cost center
integration (depends on Decision 9), expense reports (by category, by
period, by payee).

---

## Decision 12 — Tax Engine (محرك الضرائب)

**Context**: The user asked for tax configuration (Phase 11). The ERP-Lite
DB has `core.tax_rate` (id, uuid, company_id, tax_name, tax_percent,
is_active) — a minimal table. It has NO:
  - tax_mapping (tax → item / customer / supplier)
  - tax_rule (compound tax, tax inclusive vs exclusive, exemption)
  - tax_authority (who to remit to)
  - tax_return (periodic filing record)

**Options**:
- (A) Build a full Tax Engine:
      - `core.tax_mapping` (tax_rate_id, item_id | customer_id | supplier_id)
      - `core.tax_rule` (compound_order, is_inclusive, exemption_rules)
      - Auto-calculation on SO/PO line items
      - Tax reports (collected, paid, net remittance)
      - Estimated effort: ~5 days.
- (B) Use the existing `core.tax_rate` table as a reference list. Show it
      in the UI (read-only). The accountant manually computes tax amounts
      on each invoice and includes them in the total. Status: this is
      what ERP-Lite currently does.
- (C) Build minimal auto-calculation on SO/PO lines: user picks a tax_rate
      from a dropdown; the UI shows `subtotal + tax = total`. Backend stores
      the tax_rate_uuid on the SO/PO header. No compound taxes, no exemptions.
      Estimated: ~2 days.

**Default picked**: (B) — defer. The tax_rate table is exposed as a
read-only list at `/settings/tax-rates`. Full tax automation is a
significant subsystem that should be scoped separately.

**What's needed if pursued**: New tables for tax_mapping + tax_rule,
integration with sales_order_line / purchase_order_line (compute tax on
submit), tax reports (VAT return, sales tax return), potential integration
with e-invoicing APIs (Saudi Fatoora, Egyptian EIS) — each a major scope.

---

## Decision 13 — Global Search (البحث الموحَّد)

**Context**: The user requested a Global Search feature (Phase 14) that
unifies search across customers, suppliers, items, invoices, POs, SOs,
payments, receipts, journal entries.

**Options**:
- (A) Build a backend `GET /core/global-search?q=...` endpoint that
      UNIONs across multiple tables (limited to top N per type). The
      frontend renders a unified dropdown.
      Estimated: ~1.5 days.
- (B) Build a frontend-only global search that fires 8 parallel list
      queries and merges results client-side. Works today with existing
      endpoints but loads more data than needed.
      Estimated: ~0.5 day.
- (C) Skip global search. Each module has its own search (the list pages
      already filter client-side). The cross-module search is a power-user
      feature, not a daily need for SMBs.

**Default picked**: (C) — defer. Each module's list page already supports
client-side search (with URL persistence). The unified search is a UX
nice-to-have but adds complexity without clear value for SMB users.

**What's needed if pursued**: Backend `/core/global-search` endpoint with
UNION query (respecting RLS), frontend dropdown with keyboard nav and
recent-searches memory, deep-linking to detail pages.

---

## Decision 14 — Profit & Loss / Balance Sheet reports

**Context**: The Reports Center lists "قائمة الأرباح والخسائر" (P&L) and
"الميزانية العمومية" (Balance Sheet) as "غير متاح". These are core
financial statements that need a backend endpoint.

**Options**:
- (A) Build dedicated `/reporting/profit-loss` and `/reporting/balance-sheet`
      endpoints that aggregate from `accounting.general_ledger_entry` (or
      from journal_entry_line + posted status). Frontend renders as a
      structured table.
      Estimated: ~1.5 days.
- (B) Use the existing Trial Balance page as a proxy. Accountants can
      manually classify accounts into revenue/expense (P&L) vs
      asset/liability/equity (Balance Sheet). Not ideal but works.
- (C) Skip — the trial balance is sufficient for SMB needs.

**Default picked**: (A) — these are core financial statements. Should be
added next. Recorded as P1 in TODO.

**What's needed**: Backend endpoints that:
- For P&L: SUM(debit) - SUM(credit) for revenue accounts (type='revenue'),
  SUM(debit) - SUM(credit) for expense accounts (type='expense'), net = revenue - expense.
- For Balance Sheet: SUM(debit) - SUM(credit) for asset accounts (type='asset'),
  SUM(credit) - SUM(debit) for liability + equity accounts. Must balance.

Both should accept date_from / date_to (P&L) or as_of (BS) parameters.

---

## How to resolve a decision

1. Read the options above.
2. Pick one (or propose a new one).
3. Update the relevant code.
4. Update `docs/FRONTEND_STATUS.md` if the decision affects what's
   marked as "completed" / "remaining".
5. Update `BACKEND_REQUIRED.md` if the decision requires backend work.
6. Move the decision to "Resolved" below with a one-line rationale and
   the date.

---

## Resolved decisions

_None yet._
