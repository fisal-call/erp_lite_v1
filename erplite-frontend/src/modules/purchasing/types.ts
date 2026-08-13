/** src/modules/purchasing/types.ts — mirrors app/modules/purchasing/schemas.py */
export interface Supplier {
  uuid: string
  supplier_code: string
  supplier_name: string
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
  version_no: number
}

export interface SupplierCreateInput {
  supplier_code: string
  supplier_name: string
  phone?: string | null
  email?: string | null
}

export interface SupplierUpdateInput {
  supplier_name?: string
  phone?: string | null
  email?: string | null
  is_active?: boolean
  custom_fields?: Record<string, unknown> | null
  expected_version_no: number
}

export interface PurchaseOrderSummary {
  uuid: string
  document_number: string
  document_date: string
  status: string
}

export interface PurchaseOrderLine {
  item_uuid: string
  qty_ordered: string
  rate: string
}

export interface PurchaseOrder {
  uuid: string
  document_number: string
  supplier: { uuid: string }
  document_date: string
  status: string
  lines: PurchaseOrderLine[]
  created_at: string
  version_no: number
}

export interface PurchaseOrderCreateInput {
  supplier_uuid: string
  document_date: string
  currency_uuid: string
  lines: { item_uuid: string; qty_ordered: number; rate: number }[]
}
