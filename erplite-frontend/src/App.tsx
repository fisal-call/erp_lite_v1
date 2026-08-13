/**
 * src/App.tsx
 *
 * Route table. All protected routes are nested under <ProtectedRoute> +
 * <AppLayout>. Each module folder exposes its pages individually.
 *
 * Routes added during this autonomous pass:
 *   - /inventory/items/:uuid              (ItemDetailPage)
 *   - /settings/reference                 (ReferenceDataPage)
 *   - /settings/reference/currencies      (CurrenciesPage)
 *   - /settings/reference/countries       (CountriesPage)
 *   - /settings/reference/units-of-measure (UnitsOfMeasurePage)
 *
 * Performance:
 *   - All routes are lazy-loaded with React.lazy + Suspense so the main
 *     chunk stays small. Each module becomes its own JS chunk fetched on
 *     first navigation. A single <RouteFallback /> is shown while a chunk
 *     is downloading — a centered spinner matches the rest of the app.
 *
 * Foundation: App now wrapped in <ToastProvider> so any page can call
 * useToast().success(...) / .error(...) without prop drilling.
 */
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { LoginPage } from './auth/LoginPage'
import { AppLayout } from './layout/AppLayout'
import { ToastProvider, Spinner } from './components/ui'

// Eager: foundation (always needed on first paint)
const DashboardPage = lazy(() =>
  import('./modules/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

// Sales
const CustomersListPage = lazy(() =>
  import('./modules/sales/customers/CustomersListPage').then((m) => ({ default: m.CustomersListPage })),
)
const CustomerFormPage = lazy(() =>
  import('./modules/sales/customers/CustomerFormPage').then((m) => ({ default: m.CustomerFormPage })),
)
const CustomerDetailPage = lazy(() =>
  import('./modules/sales/customers/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })),
)
const CustomerEditPage = lazy(() =>
  import('./modules/sales/customers/CustomerEditPage').then((m) => ({ default: m.CustomerEditPage })),
)
const SalesOrdersListPage = lazy(() =>
  import('./modules/sales/orders/SalesOrdersListPage').then((m) => ({ default: m.SalesOrdersListPage })),
)
const SalesOrderFormPage = lazy(() =>
  import('./modules/sales/orders/SalesOrderFormPage').then((m) => ({ default: m.SalesOrderFormPage })),
)
const SalesOrderDetailPage = lazy(() =>
  import('./modules/sales/orders/SalesOrderDetailPage').then((m) => ({ default: m.SalesOrderDetailPage })),
)

// Purchasing
const SuppliersListPage = lazy(() =>
  import('./modules/purchasing/suppliers/SuppliersListPage').then((m) => ({ default: m.SuppliersListPage })),
)
const SupplierFormPage = lazy(() =>
  import('./modules/purchasing/suppliers/SupplierFormPage').then((m) => ({ default: m.SupplierFormPage })),
)
const SupplierDetailPage = lazy(() =>
  import('./modules/purchasing/suppliers/SupplierDetailPage').then((m) => ({ default: m.SupplierDetailPage })),
)
const SupplierEditPage = lazy(() =>
  import('./modules/purchasing/suppliers/SupplierEditPage').then((m) => ({ default: m.SupplierEditPage })),
)
const PurchaseOrdersListPage = lazy(() =>
  import('./modules/purchasing/orders/PurchaseOrdersListPage').then((m) => ({ default: m.PurchaseOrdersListPage })),
)
const PurchaseOrderFormPage = lazy(() =>
  import('./modules/purchasing/orders/PurchaseOrderFormPage').then((m) => ({ default: m.PurchaseOrderFormPage })),
)
const PurchaseOrderDetailPage = lazy(() =>
  import('./modules/purchasing/orders/PurchaseOrderDetailPage').then((m) => ({ default: m.PurchaseOrderDetailPage })),
)

// Inventory
const ItemsListPage = lazy(() =>
  import('./modules/inventory/items/ItemsListPage').then((m) => ({ default: m.ItemsListPage })),
)
const ItemFormPage = lazy(() =>
  import('./modules/inventory/items/ItemFormPage').then((m) => ({ default: m.ItemFormPage })),
)
const ItemDetailPage = lazy(() =>
  import('./modules/inventory/items/ItemDetailPage').then((m) => ({ default: m.ItemDetailPage })),
)
const ItemEditPage = lazy(() =>
  import('./modules/inventory/items/ItemEditPage').then((m) => ({ default: m.ItemEditPage })),
)
const StockBalancePage = lazy(() =>
  import('./modules/inventory/StockBalancePage').then((m) => ({ default: m.StockBalancePage })),
)
const WarehousesPage = lazy(() =>
  import('./modules/inventory/warehouses/WarehousesPage').then((m) => ({ default: m.WarehousesPage })),
)
const ItemCategoriesPage = lazy(() =>
  import('./modules/inventory/categories/ItemCategoriesPage').then((m) => ({ default: m.ItemCategoriesPage })),
)

// Accounting
const AccountsPage = lazy(() =>
  import('./modules/accounting/AccountsPage').then((m) => ({ default: m.AccountsPage })),
)
const JournalEntriesListPage = lazy(() =>
  import('./modules/accounting/JournalEntriesListPage').then((m) => ({ default: m.JournalEntriesListPage })),
)
const JournalEntryFormPage = lazy(() =>
  import('./modules/accounting/JournalEntryFormPage').then((m) => ({ default: m.JournalEntryFormPage })),
)
const JournalEntryDetailPage = lazy(() =>
  import('./modules/accounting/JournalEntryDetailPage').then((m) => ({ default: m.JournalEntryDetailPage })),
)
const TrialBalancePage = lazy(() =>
  import('./modules/accounting/trial-balance/TrialBalancePage').then((m) => ({ default: m.TrialBalancePage })),
)

// Reports + Settings
const ReportsIndexPage = lazy(() =>
  import('./modules/reports/ReportsIndexPage').then((m) => ({ default: m.ReportsIndexPage })),
)
const SettingsIndexPage = lazy(() =>
  import('./modules/settings/SettingsIndexPage').then((m) => ({ default: m.SettingsIndexPage })),
)
const ReferenceDataPage = lazy(() =>
  import('./modules/settings/reference/ReferenceDataPage').then((m) => ({ default: m.ReferenceDataPage })),
)
const CurrenciesPage = lazy(() =>
  import('./modules/settings/reference/CurrenciesPage').then((m) => ({ default: m.CurrenciesPage })),
)
const CountriesPage = lazy(() =>
  import('./modules/settings/reference/CountriesPage').then((m) => ({ default: m.CountriesPage })),
)
const UnitsOfMeasurePage = lazy(() =>
  import('./modules/settings/reference/UnitsOfMeasurePage').then((m) => ({ default: m.UnitsOfMeasurePage })),
)

// New: Sales invoices + receipts (transaction list endpoints)
const SalesInvoicesListPage = lazy(() =>
  import('./modules/sales/invoices/SalesInvoicesListPage').then((m) => ({ default: m.SalesInvoicesListPage })),
)
const CustomerReceiptsListPage = lazy(() =>
  import('./modules/sales/receipts/CustomerReceiptsListPage').then((m) => ({ default: m.CustomerReceiptsListPage })),
)

// New: Purchase invoices + supplier payments
const PurchaseInvoicesListPage = lazy(() =>
  import('./modules/purchasing/invoices/PurchaseInvoicesListPage').then((m) => ({ default: m.PurchaseInvoicesListPage })),
)
const SupplierPaymentsListPage = lazy(() =>
  import('./modules/purchasing/payments/SupplierPaymentsListPage').then((m) => ({ default: m.SupplierPaymentsListPage })),
)

// New: Stock movements
const StockMovementsPage = lazy(() =>
  import('./modules/inventory/stock-movements/StockMovementsPage').then((m) => ({ default: m.StockMovementsPage })),
)

// New: Finance — Receivables, Payables, Cash & Bank
const ReceivablesPage = lazy(() =>
  import('./modules/finance/receivables/ReceivablesPage').then((m) => ({ default: m.ReceivablesPage })),
)
const PayablesPage = lazy(() =>
  import('./modules/finance/payables/PayablesPage').then((m) => ({ default: m.PayablesPage })),
)
const CashBankPage = lazy(() =>
  import('./modules/finance/cash-bank/CashBankPage').then((m) => ({ default: m.CashBankPage })),
)

// New: Report sub-pages
const SalesReportsPage = lazy(() =>
  import('./modules/reports/sales/SalesReportsPage').then((m) => ({ default: m.SalesReportsPage })),
)
const PurchasingReportsPage = lazy(() =>
  import('./modules/reports/purchasing/PurchasingReportsPage').then((m) => ({ default: m.PurchasingReportsPage })),
)
const InventoryReportsPage = lazy(() =>
  import('./modules/reports/inventory/InventoryReportsPage').then((m) => ({ default: m.InventoryReportsPage })),
)
const AccountingReportsPage = lazy(() =>
  import('./modules/reports/accounting/AccountingReportsPage').then((m) => ({ default: m.AccountingReportsPage })),
)

// New: Settings — Fiscal, Payment Terms, Tax Rates
const FiscalSettingsPage = lazy(() =>
  import('./modules/settings/fiscal/FiscalSettingsPage').then((m) => ({ default: m.FiscalSettingsPage })),
)
const PaymentTermsPage = lazy(() =>
  import('./modules/settings/payment-terms/PaymentTermsPage').then((m) => ({ default: m.PaymentTermsPage })),
)
const TaxRatesPage = lazy(() =>
  import('./modules/settings/tax-rates/TaxRatesPage').then((m) => ({ default: m.TaxRatesPage })),
)

// v1.0 — Cost Centers
const CostCentersPage = lazy(() =>
  import('./modules/cost-centers/CostCentersPage').then((m) => ({ default: m.CostCentersPage })),
)

// 404 page
const NotFoundPage = lazy(() =>
  import('./modules/not-found/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Suspense fallback={<RouteFallback />}><DashboardPage /></Suspense>} />

                  <Route path="/sales/customers" element={<Suspense fallback={<RouteFallback />}><CustomersListPage /></Suspense>} />
                  <Route path="/sales/customers/new" element={<Suspense fallback={<RouteFallback />}><CustomerFormPage /></Suspense>} />
                  <Route path="/sales/customers/:uuid" element={<Suspense fallback={<RouteFallback />}><CustomerDetailPage /></Suspense>} />
                  <Route path="/sales/customers/:uuid/edit" element={<Suspense fallback={<RouteFallback />}><CustomerEditPage /></Suspense>} />
                  <Route path="/sales/orders" element={<Suspense fallback={<RouteFallback />}><SalesOrdersListPage /></Suspense>} />
                  <Route path="/sales/orders/new" element={<Suspense fallback={<RouteFallback />}><SalesOrderFormPage /></Suspense>} />
                  <Route path="/sales/orders/:uuid" element={<Suspense fallback={<RouteFallback />}><SalesOrderDetailPage /></Suspense>} />
                  <Route path="/sales/invoices" element={<Suspense fallback={<RouteFallback />}><SalesInvoicesListPage /></Suspense>} />
                  <Route path="/sales/receipts" element={<Suspense fallback={<RouteFallback />}><CustomerReceiptsListPage /></Suspense>} />

                  <Route path="/purchasing/suppliers" element={<Suspense fallback={<RouteFallback />}><SuppliersListPage /></Suspense>} />
                  <Route path="/purchasing/suppliers/new" element={<Suspense fallback={<RouteFallback />}><SupplierFormPage /></Suspense>} />
                  <Route path="/purchasing/suppliers/:uuid" element={<Suspense fallback={<RouteFallback />}><SupplierDetailPage /></Suspense>} />
                  <Route path="/purchasing/suppliers/:uuid/edit" element={<Suspense fallback={<RouteFallback />}><SupplierEditPage /></Suspense>} />
                  <Route path="/purchasing/orders" element={<Suspense fallback={<RouteFallback />}><PurchaseOrdersListPage /></Suspense>} />
                  <Route path="/purchasing/orders/new" element={<Suspense fallback={<RouteFallback />}><PurchaseOrderFormPage /></Suspense>} />
                  <Route path="/purchasing/orders/:uuid" element={<Suspense fallback={<RouteFallback />}><PurchaseOrderDetailPage /></Suspense>} />
                  <Route path="/purchasing/invoices" element={<Suspense fallback={<RouteFallback />}><PurchaseInvoicesListPage /></Suspense>} />
                  <Route path="/purchasing/payments" element={<Suspense fallback={<RouteFallback />}><SupplierPaymentsListPage /></Suspense>} />

                  <Route path="/inventory/items" element={<Suspense fallback={<RouteFallback />}><ItemsListPage /></Suspense>} />
                  <Route path="/inventory/items/new" element={<Suspense fallback={<RouteFallback />}><ItemFormPage /></Suspense>} />
                  <Route path="/inventory/items/:uuid" element={<Suspense fallback={<RouteFallback />}><ItemDetailPage /></Suspense>} />
                  <Route path="/inventory/items/:uuid/edit" element={<Suspense fallback={<RouteFallback />}><ItemEditPage /></Suspense>} />
                  <Route path="/inventory/categories" element={<Suspense fallback={<RouteFallback />}><ItemCategoriesPage /></Suspense>} />
                  <Route path="/inventory/warehouses" element={<Suspense fallback={<RouteFallback />}><WarehousesPage /></Suspense>} />
                  <Route path="/inventory/stock-balance" element={<Suspense fallback={<RouteFallback />}><StockBalancePage /></Suspense>} />
                  <Route path="/inventory/stock-movements" element={<Suspense fallback={<RouteFallback />}><StockMovementsPage /></Suspense>} />

                  <Route path="/finance/cash-bank" element={<Suspense fallback={<RouteFallback />}><CashBankPage /></Suspense>} />
                  <Route path="/finance/receivables" element={<Suspense fallback={<RouteFallback />}><ReceivablesPage /></Suspense>} />
                  <Route path="/finance/payables" element={<Suspense fallback={<RouteFallback />}><PayablesPage /></Suspense>} />

                  <Route path="/accounting/accounts" element={<Suspense fallback={<RouteFallback />}><AccountsPage /></Suspense>} />
                  <Route path="/accounting/journal-entries" element={<Suspense fallback={<RouteFallback />}><JournalEntriesListPage /></Suspense>} />
                  <Route path="/accounting/journal-entries/new" element={<Suspense fallback={<RouteFallback />}><JournalEntryFormPage /></Suspense>} />
                  <Route path="/accounting/journal-entries/:uuid" element={<Suspense fallback={<RouteFallback />}><JournalEntryDetailPage /></Suspense>} />
                  <Route path="/accounting/trial-balance" element={<Suspense fallback={<RouteFallback />}><TrialBalancePage /></Suspense>} />

                  <Route path="/reports" element={<Suspense fallback={<RouteFallback />}><ReportsIndexPage /></Suspense>} />
                  <Route path="/reports/sales" element={<Suspense fallback={<RouteFallback />}><SalesReportsPage /></Suspense>} />
                  <Route path="/reports/purchasing" element={<Suspense fallback={<RouteFallback />}><PurchasingReportsPage /></Suspense>} />
                  <Route path="/reports/inventory" element={<Suspense fallback={<RouteFallback />}><InventoryReportsPage /></Suspense>} />
                  <Route path="/reports/accounting" element={<Suspense fallback={<RouteFallback />}><AccountingReportsPage /></Suspense>} />

                  <Route path="/settings" element={<Suspense fallback={<RouteFallback />}><SettingsIndexPage /></Suspense>} />
                  <Route path="/settings/reference" element={<Suspense fallback={<RouteFallback />}><ReferenceDataPage /></Suspense>} />
                  <Route path="/settings/reference/currencies" element={<Suspense fallback={<RouteFallback />}><CurrenciesPage /></Suspense>} />
                  <Route path="/settings/reference/countries" element={<Suspense fallback={<RouteFallback />}><CountriesPage /></Suspense>} />
                  <Route path="/settings/reference/units-of-measure" element={<Suspense fallback={<RouteFallback />}><UnitsOfMeasurePage /></Suspense>} />
                  <Route path="/settings/fiscal" element={<Suspense fallback={<RouteFallback />}><FiscalSettingsPage /></Suspense>} />
                  <Route path="/settings/payment-terms" element={<Suspense fallback={<RouteFallback />}><PaymentTermsPage /></Suspense>} />
                  <Route path="/settings/tax-rates" element={<Suspense fallback={<RouteFallback />}><TaxRatesPage /></Suspense>} />
                  <Route path="/settings/cost-centers" element={<Suspense fallback={<RouteFallback />}><CostCentersPage /></Suspense>} />

                  <Route path="*" element={<Suspense fallback={<RouteFallback />}><NotFoundPage /></Suspense>} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
