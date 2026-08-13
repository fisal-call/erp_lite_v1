/** src/modules/reporting/api.ts */
import { apiClient } from '../../api/client'

export interface DashboardSummary {
  total_sales_this_month: number
  total_purchases_this_month: number
  total_ar: number
  total_ap: number
  total_customers: number
  total_suppliers: number
  total_items: number
  items_low_stock: number
  pending_sales_orders: number
  pending_purchase_orders: number
  pending_journal_entries: number
  as_of: string
}

// --- Receivables & Payables ---
export interface CustomerOutstanding {
  customer_uuid: string
  customer_code: string
  customer_name: string
  currency_uuid: string | null
  total_invoiced: number
  total_paid: number
  balance_due: number
}

export interface SupplierOutstanding {
  supplier_uuid: string
  supplier_code: string
  supplier_name: string
  currency_uuid: string | null
  total_invoiced: number
  total_paid: number
  balance_due: number
}

// --- Statement (customer & supplier share the same shape) ---
export interface StatementLine {
  posting_date: string
  document_number: string
  kind: 'invoice' | 'receipt' | 'payment' | 'return' | 'order'
  reference_uuid: string | null
  debit: number
  credit: number
  running_balance: number | null
}

export interface StatementSummary {
  opening_balance: number
  total_debit: number
  total_credit: number
  closing_balance: number
  lines: StatementLine[]
}

// --- Sales invoices / receipts / purchase invoices / supplier payments ---
export interface SalesInvoiceSummary {
  uuid: string
  document_number: string
  customer_uuid: string
  customer_name: string
  document_date: string
  due_date: string | null
  total_amount: number
  paid_amount: number
  balance_due: number
  status: string
}

export interface CustomerReceiptSummary {
  uuid: string
  document_number: string
  customer_uuid: string
  customer_name: string
  sales_invoice_uuid: string
  invoice_number: string
  receipt_date: string
  amount: number
  payment_method: string
  status: string
}

export interface PurchaseInvoiceSummary {
  uuid: string
  document_number: string
  supplier_uuid: string
  supplier_name: string
  document_date: string
  due_date: string | null
  total_amount: number
  paid_amount: number
  balance_due: number
  status: string
}

export interface SupplierPaymentSummary {
  uuid: string
  document_number: string
  supplier_uuid: string
  supplier_name: string
  purchase_invoice_uuid: string
  invoice_number: string
  payment_date: string
  amount: number
  payment_method: string
  status: string
}

// --- Cash & Bank ---
export interface CashAccount {
  uuid: string
  account_name: string
  gl_account_uuid: string
  gl_account_code: string | null
  gl_account_name: string | null
  currency_uuid: string
  currency_code: string | null
  is_active: boolean
}

export interface Bank {
  uuid: string
  bank_name: string
  is_active: boolean
}

export interface BankAccount {
  uuid: string
  bank_uuid: string
  bank_name: string | null
  account_number_masked: string
  gl_account_uuid: string
  gl_account_code: string | null
  gl_account_name: string | null
  currency_uuid: string
  currency_code: string | null
  is_active: boolean
}

// --- Stock movements / low stock ---
export interface StockMovement {
  uuid: string
  posting_date: string
  item_uuid: string
  item_code: string | null
  item_name: string | null
  warehouse_uuid: string
  warehouse_name: string | null
  qty_change: number
  valuation_rate: number | null
  source_doctype: string
  source_uuid: string
}

export interface LowStockRow {
  item_uuid: string
  item_code: string
  item_name: string
  warehouse_uuid: string | null
  warehouse_name: string | null
  qty_on_hand: number
}

// --- Analytics ---
export interface SalesByCustomer {
  customer_uuid: string | null
  customer_code: string | null
  customer_name: string | null
  total_orders: number
  total_amount: number
}

export interface SalesByItem {
  item_uuid: string | null
  item_code: string | null
  item_name: string | null
  total_qty: number
  total_amount: number
}

export interface PurchaseBySupplier {
  supplier_uuid: string | null
  supplier_code: string | null
  supplier_name: string | null
  total_orders: number
  total_amount: number
}

export interface PurchaseByItem {
  item_uuid: string | null
  item_code: string | null
  item_name: string | null
  total_orders: number
  total_qty: number
  total_amount: number
}

export interface SalesSummaryRow {
  period: string
  total_orders: number
  total_amount: number
  total_qty: number
}

export interface PurchaseSummaryRow {
  period: string
  total_orders: number
  total_amount: number
  total_qty: number
}

// --- Reference data ---
export interface FiscalYear {
  uuid: string
  year_label: string
  start_date: string
  end_date: string
  is_closed: boolean
}

export interface FiscalPeriod {
  fiscal_year_uuid: string
  period_number: number
  start_date: string
  end_date: string
  is_closed: boolean
}

export interface PaymentTerm {
  uuid: string
  term_name: string
  days_due: number
  is_active: boolean
}

export interface TaxRate {
  uuid: string
  tax_name: string
  tax_percent: number
  is_active: boolean
}

// --- Query param helpers ---
interface ListParams {
  customer_uuid?: string
  supplier_uuid?: string
  status?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

function buildParams(p: ListParams = {}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v)
  }
  return out
}

export const reportingApi = {
  getDashboardSummary: () =>
    apiClient.get<DashboardSummary>('/reporting/dashboard-summary').then((r) => r.data),

  // Receivables & Payables
  listCustomerOutstanding: () =>
    apiClient.get<CustomerOutstanding[]>('/reporting/customer-outstanding').then((r) => r.data),
  listSupplierOutstanding: () =>
    apiClient.get<SupplierOutstanding[]>('/reporting/supplier-outstanding').then((r) => r.data),
  getCustomerStatement: (customer_uuid: string, date_from?: string, date_to?: string) =>
    apiClient
      .get<StatementSummary>(`/reporting/customer-statement/${customer_uuid}`, {
        params: buildParams({ date_from, date_to }),
      })
      .then((r) => r.data),
  getSupplierStatement: (supplier_uuid: string, date_from?: string, date_to?: string) =>
    apiClient
      .get<StatementSummary>(`/reporting/supplier-statement/${supplier_uuid}`, {
        params: buildParams({ date_from, date_to }),
      })
      .then((r) => r.data),

  // Sales invoices / receipts
  listSalesInvoices: (params: ListParams = {}) =>
    apiClient.get<SalesInvoiceSummary[]>('/reporting/sales-invoices', { params: buildParams(params) }).then((r) => r.data),
  listCustomerReceipts: (params: ListParams = {}) =>
    apiClient.get<CustomerReceiptSummary[]>('/reporting/customer-receipts', { params: buildParams(params) }).then((r) => r.data),

  // Purchase invoices / supplier payments
  listPurchaseInvoices: (params: ListParams = {}) =>
    apiClient.get<PurchaseInvoiceSummary[]>('/reporting/purchase-invoices', { params: buildParams(params) }).then((r) => r.data),
  listSupplierPayments: (params: ListParams = {}) =>
    apiClient.get<SupplierPaymentSummary[]>('/reporting/supplier-payments', { params: buildParams(params) }).then((r) => r.data),

  // Cash & Bank
  listCashAccounts: () => apiClient.get<CashAccount[]>('/reporting/cash-accounts').then((r) => r.data),
  listBanks: () => apiClient.get<Bank[]>('/reporting/banks').then((r) => r.data),
  listBankAccounts: () => apiClient.get<BankAccount[]>('/reporting/bank-accounts').then((r) => r.data),

  // Inventory movements
  listStockMovements: (params: {
    item_uuid?: string
    warehouse_uuid?: string
    date_from?: string
    date_to?: string
    limit?: number
    offset?: number
  } = {}) => apiClient.get<StockMovement[]>('/reporting/stock-movements', { params: buildParams(params) }).then((r) => r.data),
  listLowStock: (threshold: number = 0) =>
    apiClient.get<LowStockRow[]>('/reporting/low-stock', { params: { threshold: String(threshold) } }).then((r) => r.data),

  // Sales analytics
  getSalesSummary: (group_by: 'day' | 'month' | 'year' = 'month', date_from?: string, date_to?: string) =>
    apiClient
      .get<SalesSummaryRow[]>('/reporting/sales-summary', {
        params: buildParams({ date_from, date_to, ...({ group_by } as any) }),
      })
      .then((r) => r.data),
  getSalesByCustomer: (date_from?: string, date_to?: string) =>
    apiClient
      .get<SalesByCustomer[]>('/reporting/sales-by-customer', { params: buildParams({ date_from, date_to }) })
      .then((r) => r.data),
  getSalesByItem: (date_from?: string, date_to?: string) =>
    apiClient
      .get<SalesByItem[]>('/reporting/sales-by-item', { params: buildParams({ date_from, date_to }) })
      .then((r) => r.data),

  // Purchase analytics
  getPurchaseSummary: (group_by: 'day' | 'month' | 'year' = 'month', date_from?: string, date_to?: string) =>
    apiClient
      .get<PurchaseSummaryRow[]>('/reporting/purchase-summary', {
        params: buildParams({ date_from, date_to, ...({ group_by } as any) }),
      })
      .then((r) => r.data),
  getPurchaseBySupplier: (date_from?: string, date_to?: string) =>
    apiClient
      .get<PurchaseBySupplier[]>('/reporting/purchase-by-supplier', { params: buildParams({ date_from, date_to }) })
      .then((r) => r.data),
  getPurchaseByItem: (date_from?: string, date_to?: string) =>
    apiClient
      .get<PurchaseByItem[]>('/reporting/purchase-by-item', { params: buildParams({ date_from, date_to }) })
      .then((r) => r.data),

  // Reference data
  listFiscalYears: () => apiClient.get<FiscalYear[]>('/reporting/fiscal-years').then((r) => r.data),
  listFiscalPeriods: (fiscal_year_uuid?: string) =>
    apiClient
      .get<FiscalPeriod[]>('/reporting/fiscal-periods', {
        params: fiscal_year_uuid ? { fiscal_year_uuid } : undefined,
      })
      .then((r) => r.data),
  listPaymentTerms: () => apiClient.get<PaymentTerm[]>('/reporting/payment-terms').then((r) => r.data),
  listTaxRates: () => apiClient.get<TaxRate[]>('/reporting/tax-rates').then((r) => r.data),
}
