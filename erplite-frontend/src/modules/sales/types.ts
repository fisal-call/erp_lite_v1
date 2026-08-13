/**
 * src/modules/sales/types.ts
 * Mirrors app/modules/sales/schemas.py exactly — uuid only, never internal id.
 */
export interface Customer {
  uuid: string
  customer_code: string
  customer_name: string
  credit_limit: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
  version_no: number
}

export interface CustomerCreateInput {
  customer_code: string
  customer_name: string
  credit_limit?: number | null
  phone?: string | null
  email?: string | null
}

/**
 * Mirrors backend `CustomerUpdate` schema. `customer_code` is intentionally
 * omitted — backend does not allow editing it after creation.
 * `expected_version_no` is required (PDR-001 optimistic locking).
 */
export interface CustomerUpdateInput {
  customer_name?: string
  credit_limit?: number | null
  phone?: string | null
  email?: string | null
  is_active?: boolean
  expected_version_no: number
}

export interface SalesOrderLine {
  item_uuid: string
  qty_ordered: string
  rate: string
}

export interface SalesOrderSummary {
  uuid: string
  document_number: string
  document_date: string
  status: string
}

export interface SalesOrder {
  uuid: string
  document_number: string
  customer: { uuid: string }
  document_date: string
  status: string
  lines: SalesOrderLine[]
  created_at: string
  version_no: number
}

export interface SalesOrderCreateInput {
  customer_uuid: string
  document_date: string
  currency_uuid: string
  lines: { item_uuid: string; qty_ordered: number; rate: number }[]
}
