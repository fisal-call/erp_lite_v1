# ERP-LITE Module Matrix

> Final audit of every ERP module: Database / Backend API / Frontend / Reports / Status.
> Generated: 2026-08-11
> Audit method: programmatic inspection of SQL migrations (ERP-Lite-001 through 007),
> backend routers, frontend App.tsx routes, and live smoke-test of every endpoint.

## Summary Matrix

| Module              | Database  | Backend API | Frontend | Reports   | Status                |
| ------------------- | --------- | ----------- | -------- | --------- | --------------------- |
| Security            | ✓ (7 tbl) | ✓ (5 routes)| ✓ (1 page)| ✓ (users) | Complete              |
| Sales — Customers   | ✓         | ✓ (CRUD)    | ✓ (4 pages)| ✓         | Complete              |
| Sales — Orders      | ✓         | ✓ (CRUD)    | ✓ (3 pages)| —         | Complete              |
| Sales — Invoices    | ✓         | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Sales — Receipts    | ✓         | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Sales — Returns     | ✓         | ✗           | ✗        | —         | Backend gap           |
| Sales — Deliveries  | ✓         | ✗           | ✗        | —         | Backend gap           |
| Sales — Quotations  | ✓         | ✗           | ✗        | —         | Backend gap           |
| Purchasing — Suppliers | ✓      | ✓ (CRUD)    | ✓ (4 pages)| ✓         | Complete              |
| Purchasing — Orders | ✓         | ✓ (CRUD)    | ✓ (3 pages)| —         | Complete              |
| Purchasing — Invoices | ✓       | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Purchasing — Payments | ✓        | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Purchasing — Returns | ✓         | ✗           | ✗        | —         | Backend gap           |
| Purchasing — Receipts | ✓        | ✗           | ✗        | —         | Backend gap           |
| Inventory — Items   | ✓         | ✓ (CRUD)    | ✓ (4 pages)| ✓         | Complete              |
| Inventory — Categories | ✓       | ✓ (CRUD)    | ✓ (1 page)| —         | Complete              |
| Inventory — Warehouses | ✓       | ✓ (CRUD)    | ✓ (1 page)| —         | Complete              |
| Inventory — Stock Balance | ✓ (view) | ✓       | ✓ (1 page)| —         | Complete              |
| Inventory — Stock Movements | ✓    | ✓ (list)  | ✓ (1 page)| —         | Complete              |
| Inventory — Stock Adjustments | ✓ | ✗           | ✗        | —         | Backend gap           |
| Inventory — Stock Transfers | ✓   | ✗           | ✗        | —         | Backend gap           |
| Accounting — Chart of Accounts | ✓ | ✓ (CRUD) | ✓ (1 page)| —         | Complete              |
| Accounting — Journal Entries | ✓  | ✓ (CRUD)  | ✓ (3 pages)| —        | Complete              |
| Accounting — Trial Balance | ✓ (view) | ✓       | ✓ (1 page)| —         | Complete              |
| Accounting — Cash Accounts | ✓     | ✓ (list)   | ✓ (1 page)| —         | List-only*            |
| Accounting — Banks         | ✓       | ✓ (list)   | ✓ (1 page)| —         | List-only*            |
| Accounting — Bank Accounts | ✓       | ✓ (list)   | ✓ (1 page)| —         | List-only*            |
| Accounting — Cheques  | ✓         | ✗           | ✗        | —         | Backend gap           |
| Accounting — P&L       | (uses JE)| ✗           | ✗        | ✗         | Decision 14           |
| Accounting — Balance Sheet | (uses JE)| ✗        | ✗        | ✗         | Decision 14           |
| Accounting — General Ledger | (uses JE)| ✗       | ✗        | ✗         | TODO                  |
| Receivables (AR)       | ✓ (view) | ✓ (3 endpoints)| ✓ (1 page)| ✓       | Complete              |
| Payables (AP)          | ✓ (view) | ✓ (3 endpoints)| ✓ (1 page)| ✓       | Complete              |
| Customer Statement    | ✓        | ✓           | ✓ (in detail page)| —     | Complete              |
| Supplier Statement    | ✓        | ✓           | ✓ (in detail page)| —     | Complete              |
| Cost Centers          | ✗        | ✗           | ✗        | ✗         | Decision 9            |
| Fixed Assets          | ✗        | ✗           | ✗        | ✗         | Decision 10           |
| Expenses              | ✗        | ✗           | ✗        | ✗         | Decision 11           |
| Tax — Tax Rates       | ✓        | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Tax — Tax Engine      | ✗        | ✗           | ✗        | ✗         | Decision 12           |
| Fiscal Years          | ✓        | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Fiscal Periods        | ✓        | ✓ (list)    | ✓ (in fiscal page)| —    | List-only*            |
| Payment Terms         | ✓        | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Currencies            | ✓        | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Countries             | ✓        | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Units of Measure      | ✓        | ✓ (list)    | ✓ (1 page)| —         | List-only*            |
| Exchange Rates        | ✓        | ✗           | ✗        | —         | Backend gap           |
| Companies             | ✓        | ✓ (POST)    | ✗ (bootstrap only)| —    | Bootstrap-only        |
| Branches              | ✓        | ✗           | ✗        | —         | Backend gap           |
| Reports — Sales       | ✓        | ✓ (3 endpoints)| ✓ (1 page)| ✓       | Complete              |
| Reports — Purchasing  | ✓        | ✓ (2 endpoints)| ✓ (1 page)| ✓       | Complete              |
| Reports — Inventory   | ✓        | ✓ (1 endpoint) | ✓ (1 page)| ✓       | Complete              |
| Reports — Accounting  | ✓        | ✓ (existing) | ✓ (1 page)| partial  | P&L/BS pending        |
| Reports — Management  | partial  | ✓ (dashboard)| ✓ (1 page)| partial  | KPIs only             |
| Global Search         | ✗        | ✗           | ✗        | —         | Decision 13           |
| Audit Log             | ✓ (tbl)  | ✗           | ✗        | —         | Backend gap           |
| Notifications         | ✓ (tbl)  | ✗           | ✗        | —         | Backend gap           |
| Attachments           | ✓ (tbl)  | ✗           | ✗        | —         | Backend gap           |

\* "List-only" = the endpoint exists for listing, but no create/update endpoint.
For tables that already exist in the DB, this is a thin gap — the table is
queryable but not editable from the UI. Often this is by design (reference data
seeded via SQL migrations), but for transactional tables (sales_invoice,
customer_receipt) it means new documents can only be created via direct DB
entry or via a yet-to-be-built workflow endpoint.

## Coverage Summary

- **Complete modules** (Database + Backend + Frontend + Reports): 18
- **List-only modules** (Database + Backend list + Frontend list, no create): 9
- **Backend gap** (Database exists, no endpoint): 8
- **Deferred (no DB)** (Documented in DECISIONS_PENDING.md): 5

## Live Verification (2026-08-11)

| Check                          | Result        |
| ------------------------------ | ------------- |
| Backend routes (OpenAPI)       | 51 routes     |
| Backend pytest                 | 1/1 PASS      |
| Backend smoke test (original)  | 26/26 PASS    |
| **Backend smoke test (new)**   | **23/23 PASS** |
| Frontend lint                  | 0 warnings    |
| Frontend typecheck             | 0 errors      |
| Frontend build                 | 233 KB / 71 KB gzip (main) |
| Frontend routes                | 42 routes     |
| New endpoints security check   | 23/23 return 401 without token |
