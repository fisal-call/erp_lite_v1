/** src/modules/accounting/api.ts */
import { apiClient } from '../../api/client'

export interface Account {
  uuid: string
  account_code: string
  account_name: string
  account_type: string
  is_group: boolean
  is_active: boolean
  created_at: string
  version_no: number
}

export interface JournalEntrySummary {
  uuid: string
  document_number: string
  posting_date: string
  status: string
}

export interface JournalEntryLine {
  account_uuid: string
  debit_amount: string
  credit_amount: string
}

export interface JournalEntry {
  uuid: string
  document_number: string
  posting_date: string
  narration: string | null
  status: string
  lines: JournalEntryLine[]
  version_no: number
}

export interface TrialBalanceRow {
  account_code: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
  net_balance: number
}

export const accountingApi = {
  listAccounts: () => apiClient.get<Account[]>('/accounting/accounts').then((r) => r.data),

  createAccount: (data: { account_code: string; account_name: string; account_type: string; is_group: boolean; parent_account_uuid?: string }) =>
    apiClient.post<Account>('/accounting/accounts', data).then((r) => r.data),

  listJournalEntries: (search?: string) =>
    apiClient
      .get<JournalEntrySummary[]>('/accounting/journal-entries', {
        params: search ? { search } : undefined,
      })
      .then((r) => r.data),

  createJournalEntry: (data: {
    posting_date: string
    narration?: string
    lines: { account_uuid: string; debit_amount: number; credit_amount: number }[]
  }) => apiClient.post<JournalEntry>('/accounting/journal-entries', data).then((r) => r.data),

  getJournalEntry: (uuid: string) =>
    apiClient.get<JournalEntry>(`/accounting/journal-entries/${uuid}`).then((r) => r.data),

  submitJournalEntry: (uuid: string) =>
    apiClient.post<JournalEntry>(`/accounting/journal-entries/${uuid}/submit`).then((r) => r.data),

  /** Reads from reporting.v_trial_balance (aggregates posted journal entries). */
  listTrialBalance: () =>
    apiClient.get<TrialBalanceRow[]>('/accounting/trial-balance').then((r) => r.data),
}
