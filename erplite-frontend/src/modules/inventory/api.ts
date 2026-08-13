/**
 * src/modules/inventory/api.ts
 */
import { apiClient } from '../../api/client'

export interface Item {
  uuid: string
  item_code: string
  item_name: string
  is_active: boolean
  created_at: string
  version_no: number
}

export interface ItemCategory {
  uuid: string
  category_name: string
  is_active: boolean
  created_at: string
  version_no: number
}

export interface Warehouse {
  uuid: string
  warehouse_name: string
  allow_negative_stock: boolean
  is_active: boolean
  created_at: string
  version_no: number
}

export interface StockBalance {
  item_code: string
  item_name: string
  warehouse_name: string
  qty_on_hand: number
}

interface Page<T> {
  items: T[]
  total: number
}

export interface ItemUpdateInput {
  item_name?: string
  is_active?: boolean
  custom_fields?: Record<string, unknown> | null
  expected_version_no: number
}

export const inventoryApi = {
  searchItems: (search: string) =>
    apiClient.get<Page<Item>>('/inventory/items', { params: { search, page_size: 20 } }).then((r) => r.data.items),

  listItems: () =>
    apiClient.get<Page<Item>>('/inventory/items', { params: { page_size: 200 } }).then((r) => r.data.items),

  getItem: (uuid: string) => apiClient.get<Item>(`/inventory/items/${uuid}`).then((r) => r.data),

  createItem: (data: { item_code: string; item_name: string; item_category_uuid: string; base_uom_uuid: string }) =>
    apiClient.post<Item>('/inventory/items', data).then((r) => r.data),

  updateItem: (uuid: string, data: ItemUpdateInput) =>
    apiClient.patch<Item>(`/inventory/items/${uuid}`, data).then((r) => r.data),

  listItemCategories: () => apiClient.get<ItemCategory[]>('/inventory/item-categories').then((r) => r.data),

  createItemCategory: (category_name: string) =>
    apiClient.post<ItemCategory>('/inventory/item-categories', { category_name }).then((r) => r.data),

  listWarehouses: () => apiClient.get<Warehouse[]>('/inventory/warehouses').then((r) => r.data),
  // Backend exposes GET /inventory/warehouses (non-paginated, RLS-scoped).

  createWarehouse: (data: { warehouse_name: string; allow_negative_stock: boolean }) =>
    apiClient.post<Warehouse>('/inventory/warehouses', data).then((r) => r.data),

  stockBalance: () => apiClient.get<StockBalance[]>('/inventory/stock-balance').then((r) => r.data),
}
