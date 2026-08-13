/**
 * src/modules/core-org/api.ts
 *
 * Thin wrappers around the core_org endpoints. Mirrors
 * app/modules/core_org/router.py:
 *   - POST /core/companies (bootstrap — not exposed in UI; documented gap)
 *   - GET  /core/currencies
 *   - GET  /core/countries
 *   - GET  /core/units-of-measure
 *
 * No create/update endpoints exist for these reference tables (the schema is
 * seeded via SQL migrations) — so the UI surfaces them as read-only.
 */
import { apiClient } from '../../api/client'

export interface Currency {
  uuid: string
  iso_code: string
  name_ar: string
  name_en: string
  symbol: string | null
}

export interface Country {
  uuid: string
  iso_code: string
  name_ar: string
  name_en: string
}

export interface UnitOfMeasure {
  uuid: string
  uom_name: string
}

export interface Company {
  uuid: string
  company_name: string
  timezone: string
  inventory_valuation_method: string
  is_active: boolean
}

export const coreOrgApi = {
  listCurrencies: () => apiClient.get<Currency[]>('/core/currencies').then((r) => r.data),

  listCountries: () => apiClient.get<Country[]>('/core/countries').then((r) => r.data),

  listUnitsOfMeasure: () =>
    apiClient.get<UnitOfMeasure[]>('/core/units-of-measure').then((r) => r.data),
}
