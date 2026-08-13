/** src/modules/purchasing/api.ts */
import { apiClient } from '../../api/client'
import type { Supplier, SupplierCreateInput, SupplierUpdateInput, PurchaseOrder, PurchaseOrderCreateInput, PurchaseOrderSummary } from './types'

export const purchasingApi = {
  listSuppliers: () => apiClient.get<Supplier[]>('/purchasing/suppliers').then((r) => r.data),
  getSupplier: (uuid: string) => apiClient.get<Supplier>(`/purchasing/suppliers/${uuid}`).then((r) => r.data),
  createSupplier: (data: SupplierCreateInput) =>
    apiClient.post<Supplier>('/purchasing/suppliers', data).then((r) => r.data),
  updateSupplier: (uuid: string, data: SupplierUpdateInput) =>
    apiClient.patch<Supplier>(`/purchasing/suppliers/${uuid}`, data).then((r) => r.data),

  listPurchaseOrders: (search?: string) =>
    apiClient
      .get<PurchaseOrderSummary[]>('/purchasing/purchase-orders', {
        params: search ? { search } : undefined,
      })
      .then((r) => r.data),
  createPurchaseOrder: (data: PurchaseOrderCreateInput) =>
    apiClient.post<PurchaseOrder>('/purchasing/purchase-orders', data).then((r) => r.data),
  getPurchaseOrder: (uuid: string) =>
    apiClient.get<PurchaseOrder>(`/purchasing/purchase-orders/${uuid}`).then((r) => r.data),
  submitPurchaseOrder: (uuid: string, expected_version_no: number) =>
    apiClient
      .post<PurchaseOrder>(`/purchasing/purchase-orders/${uuid}/submit`, { expected_version_no })
      .then((r) => r.data),
}
