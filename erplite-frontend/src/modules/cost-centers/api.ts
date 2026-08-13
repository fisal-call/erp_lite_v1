/**
 * src/modules/cost-centers/api.ts
 */
import { apiClient } from '../../api/client'
import type { CostCenter, CostCenterCreateInput, CostCenterUpdateInput } from './types'

export const costCentersApi = {
  list: () => apiClient.get<CostCenter[]>('/cost-centers').then((r) => r.data),
  get: (uuid: string) => apiClient.get<CostCenter>(`/cost-centers/${uuid}`).then((r) => r.data),
  create: (data: CostCenterCreateInput) =>
    apiClient.post<CostCenter>('/cost-centers', data).then((r) => r.data),
  update: (uuid: string, data: CostCenterUpdateInput) =>
    apiClient.patch<CostCenter>(`/cost-centers/${uuid}`, data).then((r) => r.data),
}
