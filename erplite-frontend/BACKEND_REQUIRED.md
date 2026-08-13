# BACKEND_REQUIRED — ERP-Lite Frontend Integration Gaps

This file lists every backend endpoint, capability, or schema change the
frontend would benefit from. **Each gap is currently handled gracefully by
the frontend** (either via a clearly-labeled "غير متاح حالياً" panel, or via
client-side filtering), so the application is fully usable today. These
items are listed so the next backend pass can close them in priority order.

> Source of truth for the backend: `/home/z/my-project/erplite-backend/`
> Frontend uses `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`)

---

## 1. Reporting endpoints (HIGH PRIORITY — directly blocks dashboard KPIs)

The database already has the underlying views (Phase 2 SQL):
- `reporting.v_stock_balance` ✅ (exposed via `GET /inventory/stock-balance`)
- `reporting.v_customer_outstanding` ❌ (not exposed)
- `reporting.v_supplier_outstanding` ❌ (not exposed)
- `reporting.v_trial_balance` ❌ (not exposed)

### 1.1 `GET /api/v1/reporting/dashboard-summary`

**Used by:** Dashboard (`/`)
**Why needed:** The 4 financial KPI cards on the dashboard are currently
showing "غير متاح حالياً":
- إجمالي المبيعات هذا الشهر
- إجمالي المشتريات هذا الشهر
- ذمم مدينة (عملاء) — total of `v_customer_outstanding.balance_due`
- ذمم دائنة (موردون) — total of `v_supplier_outstanding.balance_due`

**Suggested response shape:**
```json
{
  "total_sales_this_month": "decimal",
  "total_purchases_this_month": "decimal",
  "total_ar": "decimal",
  "total_ap": "decimal",
  "as_of": "ISO date"
}
```

### 1.2 `GET /api/v1/accounting/trial-balance`

**Used by:** Trial Balance page (`/accounting/trial-balance`)
**Why needed:** Currently shows "غير متاح حالياً". The view
`reporting.v_trial_balance` already exists in Phase 2 SQL — only the
HTTP endpoint is missing.

**Suggested query params:** `from_date`, `to_date` (optional)
**Suggested response shape:**
```json
[
  { "account_code": "1000", "account_name": "...", "debit": "...", "credit": "...", "balance": "..." }
]
```

### 1.3 Sales/Purchasing/Inventory reports

All of the following are listed in the Reports page (`/reports`) as
"غير متاح":

- `GET /api/v1/reporting/sales-summary`
- `GET /api/v1/reporting/sales-by-customer`
- `GET /api/v1/reporting/sales-by-item`
- `GET /api/v1/reporting/purchase-summary`
- `GET /api/v1/reporting/purchase-by-supplier`
- `GET /api/v1/reporting/purchase-by-item`
- `GET /api/v1/inventory/stock-ledger` (movements history)
- `GET /api/v1/accounting/accounts/{uuid}/movements` (account ledger)

Each is a straightforward aggregation query against existing tables/views.

---

## 2. List-endpoint pagination & server-side search (MEDIUM PRIORITY)

### Current state
Only **one** list endpoint supports pagination + server-side search:
- `GET /api/v1/inventory/items?page=1&page_size=50&search=...`

All other list endpoints return up to 200 (or 500 for accounts) rows with
no pagination or `search` query param:
- `GET /api/v1/sales/customers`
- `GET /api/v1/sales/sales-orders`
- `GET /api/v1/purchasing/suppliers`
- `GET /api/v1/purchasing/purchase-orders`
- `GET /api/v1/accounting/accounts`
- `GET /api/v1/accounting/journal-entries`
- `GET /api/v1/inventory/warehouses`
- `GET /api/v1/inventory/item-categories`
- `GET /api/v1/inventory/stock-balance`

### Frontend current handling
The frontend does **client-side** search filtering on each list page. This
works correctly for the typical ERP-Lite per-company dataset size but
breaks down at scale.

### Suggested change (per endpoint)
Add `page: int = 1 (ge=1)`, `page_size: int = 50 (ge=1, le=200)`,
`search: str | None = None` query params and return `Page[T]` instead of
`list[T]`. The shared `Page[T]` schema already exists in
`app/shared/schemas.py`.

> Backward-compat note: switching `list[T]` → `Page[T]` is a breaking
> change for the frontend. If done, the frontend's `api.ts` files will
> need to be updated to unwrap `.items` (the items endpoint already does
> this — copy that pattern).

---

## 3. User management (MEDIUM PRIORITY — security-sensitive)

### Current state
- `POST /api/v1/security/users` exists (deliberately unauthenticated — bootstrap gap)
- `GET /api/v1/security/users/{user_uuid}` exists but no auth dependency declared
- **NO `GET /api/v1/security/users` (list) endpoint exists**
- **NO `PATCH /api/v1/security/users/{uuid}` endpoint exists**
- **NO role/permission endpoints exist**

### Frontend current handling
The Settings page (`/settings`) shows clear "غير متاح حالياً" panels for
Users, Roles/Permissions, Company, and Branches management.

### Suggested additions
- `GET /api/v1/security/users` — paginated list (admin-only)
- `PATCH /api/v1/security/users/{uuid}` — update is_active, full_name, email
- `GET /api/v1/security/roles` — list available roles
- `POST /api/v1/security/users/{uuid}/roles` — assign role

### Critical security note (already in backend CHANGELOG §Phase 3 ⏳)
> `/core/companies` and `/security/users` are deliberately unauthenticated
> (bootstrap problem). They MUST be locked down (e.g. require an Admin
> role after first user is created) before any production use.

---

## 4. Document creator name (LOW PRIORITY — UX nice-to-have)

### Current state
Every document response (SalesOrder, PurchaseOrder, JournalEntry) returns
`created_at` and `version_no` but **not** the creator's display name.
Only the internal `created_by` ID is stored in the DB.

### Frontend current handling
Detail pages show date and version but cannot show "أُنشئ بواسطة [name]".

### Suggested change
Either:
- JOIN `security.app_user` in the Read DTOs and add a `created_by_name: str`
  field, OR
- Add a separate `GET /api/v1/security/users/{uuid}` lookup (already
  exists) and let the frontend resolve it (less efficient — N+1).

The first option is preferable.

---

## 5. Customer/Supplier PATCH asymmetry (LOW PRIORITY)

### Current state
- `PATCH /api/v1/sales/customers/{uuid}` ✅ exists (with optimistic lock)
- `PATCH /api/v1/purchasing/suppliers/{uuid}` ❌ does NOT exist

### Frontend current handling
The Supplier detail page (`/purchasing/suppliers/:uuid`) shows the
supplier's data read-only with no Edit button. A small notice could be
added if desired, but the current behavior is consistent with what the
backend exposes.

### Suggested addition
Add `PATCH /api/v1/purchasing/suppliers/{uuid}` mirroring the customer
PATCH (with `expected_version_no` for PDR-001).

---

## 6. Branch / Company management endpoints (LOW PRIORITY)

### Current state
- `POST /api/v1/core/companies` exists (bootstrap only, no auth)
- No `GET /api/v1/core/companies/me` (current company info)
- No `GET /api/v1/core/branches` (list branches)
- No `POST /api/v1/core/branches` (create branch)

### Frontend current handling
Settings page shows "غير متاح حالياً" panels for these.

### Suggested additions
- `GET /api/v1/core/companies/me` — returns current company info (from JWT)
- `GET /api/v1/core/branches` — list branches of current company
- `POST /api/v1/core/branches` — create new branch

---

## 7. Backend DTO fields accepted but NOT persisted (LOW PRIORITY)

Per backend audit (CHANGELOG + endpoint inventory):

| Field | DTO | Status |
|---|---|---|
| `parent_account_uuid` | `AccountCreate` | accepted, not persisted |
| `branch_uuid` | `WarehouseCreate` | accepted, not persisted |
| `branch_uuid` | `SalesOrderCreate` | accepted, not persisted (hardcoded None) |
| `tax_rate_uuid` | `SalesOrderLineCreate` | accepted, not persisted in line loop |

### Frontend current handling
The frontend **does not send these fields** in the create forms, because
we know they wouldn't take effect. This is consistent with
"NO API = NO FEATURE" — we don't expose a UI control that doesn't do
anything.

### Suggested fix (backend)
Either wire these fields in the service layer, OR remove them from the
DTOs to make the contract honest. Wiring is preferable.

---

## 8. JournalEntry submit asymmetry (LOW PRIORITY)

### Current state
- `POST /api/v1/sales/sales-orders/{uuid}/submit` — body: `{expected_version_no}`
- `POST /api/v1/purchasing/purchase-orders/{uuid}/submit` — body: `{expected_version_no}`
- `POST /api/v1/accounting/journal-entries/{uuid}/submit` — **no body**

### Frontend current handling
The JE detail page calls submit without arguments — works correctly
today. The 409 conflict handler is in place defensively, but it will
never trigger with the current backend.

### Suggested fix
For consistency, add `expected_version_no` to the JE submit body too.
This makes the optimistic-locking story uniform across all document types.

---

## Summary table

| # | Endpoint / capability | Priority | Frontend handling |
|---|---|---|---|
| 1.1 | `GET /reporting/dashboard-summary` | HIGH | "غير متاح" panel |
| 1.2 | `GET /accounting/trial-balance` | HIGH | "غير متاح" page |
| 1.3 | 8 reporting endpoints | MEDIUM | "غير متاح" cards in Reports page |
| 2 | Pagination + `search=` on 9 list endpoints | MEDIUM | Client-side filter (works at small scale) |
| 3 | User/role management endpoints | MEDIUM | "غير متاح" panels in Settings |
| 4 | `created_by_name` field on document DTOs | LOW | Not shown |
| 5 | `PATCH /purchasing/suppliers/{uuid}` | LOW | Read-only supplier detail |
| 6 | Company/branch management endpoints | LOW | "غير متاح" panels in Settings |
| 7 | Wire or remove unused DTO fields | LOW | Frontend doesn't send them |
| 8 | `expected_version_no` on JE submit | LOW | Defensive 409 handler in place |

**The frontend is fully usable today without any of these being fixed.**
Each gap is either handled with a clear "غير متاح حالياً" UI or worked
around with client-side logic that is correct for typical ERP-Lite data
volumes.
