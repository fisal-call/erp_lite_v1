/**
 * src/modules/cost-centers/types.ts
 */
export interface CostCenter {
  uuid: string
  cost_center_code: string
  cost_center_name: string
  parent_cost_center_uuid: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
  version_no: number
}

export interface CostCenterCreateInput {
  cost_center_code: string
  cost_center_name: string
  parent_cost_center_uuid?: string | null
}

export interface CostCenterUpdateInput {
  cost_center_name?: string
  is_active?: boolean
  expected_version_no: number
}
