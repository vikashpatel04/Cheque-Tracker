export type ChequeStatus =
  | 'PENDING'
  | 'DEPOSITED'
  | 'PASSED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'WRITTEN_OFF'

export type ChangedBy = 'manual' | 'auto' | 'deposit_allocation' | 'rollback'

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
  /** Date printed on the cheque, set when a returned cheque is re-presented with a new due_date. */
  original_due_date: string | null
  /** Times this cheque was returned and re-presented. */
  represent_count: number
  /** Reason given when the cheque was written off (status WRITTEN_OFF). */
  write_off_reason: string | null
  /** For a new cheque issued in place of a written-off one. */
  replaces_cheque_id: string | null
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
  /** Set on rollback rows: the history row that was undone. */
  reverts_history_id?: string | null
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

/**
 * Forward status changes available from the generic status actions.
 * RETURNED has dedicated actions instead (re-present / write off), and any
 * change can be undone with rollback.
 */
export const VALID_STATUS_TRANSITIONS: Record<ChequeStatus, ChequeStatus[]> = {
  PENDING: ['DEPOSITED', 'RETURNED', 'CANCELLED'],
  DEPOSITED: ['PASSED', 'RETURNED', 'CANCELLED'],
  PASSED: [],
  RETURNED: [],
  CANCELLED: [],
  WRITTEN_OFF: [],
}

export const ALL_STATUSES: ChequeStatus[] = ['PENDING', 'DEPOSITED', 'PASSED', 'RETURNED', 'CANCELLED', 'WRITTEN_OFF']

export const STATUS_LABELS: Record<ChequeStatus, string> = {
  PENDING: 'Pending',
  DEPOSITED: 'Deposited',
  PASSED: 'Passed',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
  WRITTEN_OFF: 'Written Off',
}

/** Statuses where the cheque is finished — no due-date countdown. */
export const CLOSED_STATUSES: ChequeStatus[] = ['PASSED', 'RETURNED', 'CANCELLED', 'WRITTEN_OFF']
