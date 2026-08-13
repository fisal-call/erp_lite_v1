/**
 * src/modules/sales/api.ts
 * Thin wrapper — one function per backend endpoint, no logic here.
 */
import { apiClient } from '../../api/client'
import type { Customer, CustomerCreateInput, CustomerUpdateInput, SalesOrder, SalesOrderCreateInput, SalesOrderSummary } from './types'

export const salesApi = {
  listCustomers: () => apiClient.get<Customer[]>('/sales/customers').then((r) => r.data),
  getCustomer: (uuid: string) => apiClient.get<Customer>(`/sales/customers/${uuid}`).then((r) => r.data),

  createCustomer: (data: CustomerCreateInput) =>
    apiClient.post<Customer>('/sales/customers', data).then((r) => r.data),

  updateCustomer: (uuid: string, data: CustomerUpdateInput) =>
    apiClient.patch<Customer>(`/sales/customers/${uuid}`, data).then((r) => r.data),

  listSalesOrders: (search?: string) =>
    apiClient
      .get<SalesOrderSummary[]>('/sales/sales-orders', {
        params: search ? { search } : undefined,
      })
      .then((r) => r.data),

  createSalesOrder: (data: SalesOrderCreateInput) =>
    apiClient.post<SalesOrder>('/sales/sales-orders', data).then((r) => r.data),

  getSalesOrder: (uuid: string) => apiClient.get<SalesOrder>(`/sales/sales-orders/${uuid}`).then((r) => r.data),

  submitSalesOrder: (uuid: string, expected_version_no: number) =>
    apiClient
      .post<SalesOrder>(`/sales/sales-orders/${uuid}/submit`, { expected_version_no })
      .then((r) => r.data),
}
