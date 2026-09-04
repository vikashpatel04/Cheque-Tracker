export type ChequeStatus =
  | 'PENDING'
  | 'DEPOSITED'
  | 'PASSED'
  | 'RETURNED'
  | 'CANCELLED'

export type ChangedBy = 'manual' | 'auto' | 'deposit_allocation'

export type AllocationSort = 'due_date_asc' | 'amount_asc' | 'amount_desc'

export interface Party {
  id: string
  user_id: string
  name: string
  contact_name: string | null
  phone: string | null
  bank_name: string | null
  notes: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
}

export interface Cheque {
  id: string
  user_id: string
  party_id: string
  cheque_number: string
  bank_name: string
  amount: number
  issue_date: string
  due_date: string
  status: ChequeStatus
  return_reason: string | null
  auto_transition_blocked: boolean
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  party?: Party
}

export interface ChequeHistory {
  id: string
  cheque_id: string
  from_status: ChequeStatus
  to_status: ChequeStatus
  changed_by: ChangedBy
  note: string | null
  created_at: string
  cheque?: Cheque & { party?: Party }
}

export interface DailyDeposit {
  id: string
  user_id: string
  amount: number
  deposit_date: string
  notes: string | null
  created_at: string
}

export interface Settings {
  id: string
  user_id: string
  auto_pass_time: string
  /**
   * When true, DEPOSITED cheques past their due date are auto-marked PASSED
   * at the auto_pass_time. PENDING cheques are never auto-passed.
   * When false (default), no automatic transitions occur.
   * Cheque dates never change regardless of this setting.
   */
  auto_pass_enabled: boolean
  currency_symbol: string
  allocation_sort: AllocationSort
  /**
   * User-configured list of banks for dropdown selection.
   */
  banks: string[]
  created_at: string
  updated_at: string
}

export interface UpdateChequeStatusOptions {
  changedBy: ChangedBy
  note?: string
  returnReason?: string
}

export interface AllocationCheque extends Cheque {
  party: Party
  selected: boolean
}

export const VALID_STATUS_TRANSITIONS: Record<ChequeStatus, ChequeStatus[]> = {
  PENDING: ['DEPOSITED', 'RETURNED', 'CANCELLED'],
  DEPOSITED: ['PASSED', 'RETURNED', 'CANCELLED'],
  PASSED: [],
  RETURNED: [],
  CANCELLED: [],
}
