# ERP-Lite Frontend

> Arabic-first, mobile-first, RTL ERP frontend for the ERP-Lite platform.
> Built with React 19 + TypeScript + Vite + Tailwind CSS + TanStack Query +
> react-hook-form + Zod + axios.

## Quick start

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview

# Lint + type-check
npm run lint
npx tsc --noEmit
```

The frontend expects the ERP-Lite backend running on
`http://localhost:8000/api/v1` (override with `VITE_API_BASE_URL`).

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API base URL |

Set in `.env` (gitignored) or shell environment.

## Project structure

```
src/
├── App.tsx                          ← Route table + providers
├── main.tsx                         ← Bootstrap
├── index.css                        ← Design system + print styles + .ltr-text
├── api/client.ts                    ← Centralized axios + JWT + 401 + ApiError
├── auth/                            ← AuthContext, ProtectedRoute, LoginPage
├── layout/AppLayout.tsx             ← RTL sidebar + mobile drawer
├── components/
│   ├── ui/                          ← Shared primitives (14 components)
│   ├── AccountAutocomplete.tsx      ← Searchable account picker (NEW)
│   ├── CustomerAutocomplete.tsx
│   ├── SupplierAutocomplete.tsx
│   ├── ItemAutocomplete.tsx
│   └── StatusBadge.tsx
└── modules/
    ├── dashboard/                   ← Real KPIs only (no fake data)
    ├── sales/                       ← customers + orders
    ├── purchasing/                  ← suppliers + orders
    ├── inventory/                   ← items + categories + warehouses + stock
    ├── accounting/                  ← accounts + journal entries + trial balance
    ├── core-org/api.ts              ← Currency / Country / UoM (read-only)
    ├── reports/                     ← Reports catalog
    └── settings/
        ├── SettingsIndexPage.tsx
        └── reference/               ← NEW: read-only reference data
```

## Architecture principles

1. **Backend is source of truth** — the frontend never invents data. If an
   endpoint doesn't exist, the UI shows "غير متاح حالياً" with a pointer
   to `BACKEND_REQUIRED.md`.
2. **NO API = NO FEATURE** — no fake data, no mock success, no fake
   pagination. Each gap is documented.
3. **Optimistic locking (PDR-001)** — every mutating endpoint takes
   `expected_version_no`. On 409, the frontend refetches + shows an Arabic
   notice.
4. **BR-ACC-001 (no edit on submitted JE)** — enforced by backend omission
   (no PUT/PATCH endpoint). The frontend mirrors by hiding the edit
   affordance entirely.
5. **BR-ACC-003 (balanced JE)** — enforced client-side with a live balance
   check. The backend is the final judge.
6. **Auth** — JWT in `localStorage` (acceptable for an internal ERP;
   HttpOnly cookies would be more secure but require backend changes).
7. **RLS** — enforced server-side. The frontend's role is display + input
   validation, NOT authorization.
8. **Modular** — each module owns its `api.ts` + `types.ts` + pages. No
   cross-module imports except via the shared `components/ui` primitives.

## Documentation

| File | Purpose |
|---|---|
| `docs/FRONTEND_STATUS.md` | Full status (completed / in-progress / remaining) |
| `docs/AI_HANDOFF.md` | Entry point for the next AI agent (Aider/DeepSeek/Claude Code) |
| `docs/TODO.md` | Condensed backlog with priorities |
| `docs/BACKEND_ISSUES.md` | Discovered backend issues (with workarounds) |
| `docs/DECISIONS_PENDING.md` | Business decisions needing human review |
| `BACKEND_REQUIRED.md` | Exhaustive list of backend endpoints needed |

## What's done

- 32 routes, all wired to real backend endpoints OR clearly marked as "غير متاح"
- 14 shared UI primitives in `src/components/ui/`
- 4 reusable autocomplete components
- Auth (login/logout/JWT/protected routes)
- Dashboard with real KPIs (counts + status breakdowns; financial KPIs = "غير متاح")
- Sales: customers (list/form/detail/edit) + sales orders (list/form/detail/submit)
- Purchasing: suppliers (list/form/detail) + purchase orders (list/form/detail/submit)
- Inventory: items (list/form/detail) + categories + warehouses + stock balance
- Accounting: accounts (list + inline create) + journal entries (list/form/detail/submit) + trial balance (غير متاح)
- Settings: catalog of available/unavailable features + read-only reference data
- Reports: catalog of available/unavailable reports
- RTL Arabic-first UI, mobile-first responsive, print CSS for documents
- Toast notifications on every create/submit
- Count summary + status filter + clickable rows on every list page
- UUIDs resolved to names in all detail pages (customer/supplier/item/account)
- All lint/tsc/build pass (0 warnings, 0 errors)

## What's NOT done (and why)

See `docs/TODO.md` for the full backlog. Highlights:

- **Trial Balance page**: backend view exists, HTTP endpoint missing → "غير متاح"
- **Dashboard financial KPIs**: backend endpoint missing → "غير متاح"
- **Users / Roles / Company / Branch management**: backend endpoints missing → "غير متاح"
- **Sales/Purchase Invoices, Purchase Receipts, Stock Movements**: full new modules, out of scope
- **Customer/Supplier statements, General Ledger, P&L, Balance Sheet**: backend reporting endpoints missing

The frontend is **fully usable today** with the existing backend. Every gap
is either handled with a clear "غير متاح" panel or worked around with
client-side logic that is correct for typical ERP-Lite volumes.

## License

Proprietary — internal ERP-Lite project.
