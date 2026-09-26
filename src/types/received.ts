import type { Party } from '@/types'

/**
 * Cheques other people give you. They live in their own tables
 * (received_cheques, received_cheque_history); see docs/received-cheques.md.
 */
export type ReceivedStatus =
  | 'IN_HAND'
  | 'DEPOSITED'
  | 'CLEARED'
  | 'BOUNCED'
  | 'SETTLED'
  | 'HANDED_BACK'
  | 'WRITTEN_OFF'
  | 'REPLACED'

/** Security cheques are held, not deposited on a date; amount and date may be blank. */
export type ReceivedKind = 'REGULAR' | 'SECURITY'

/** How a cheque was paid when the payer settled another way. */
export type SettlementMethod = 'CASH' | 'TRANSFER' | 'OTHER'

export type ReceivedAction =
  | 'deposit'
  | 'clear'
  | 'bounce'
  | 'redeposit'
  | 'settle'
  | 'hand_back'
  | 'write_off'
  | 'replace'

/** One of the user's own bank accounts. Only the last four characters of the number are kept. */
export interface BankAccount {
  id: string
  user_id: string
  name: string
  bank_name: string
  last4: string | null
  is_default: boolean
  deleted_at: string | null
  created_at: string
}

export interface ReceivedCheque {
  id: string
  user_id: string
  party_id: string
  kind: ReceivedKind
  cheque_number: string
  /** The bank the cheque is drawn on (the payer's bank). */
  bank_name: string
  /** Null only for security cheques left blank. */
  amount: number | null
  received_on: string
  /** Date written on the cheque; validity is counted from it. Null only for undated security cheques. */
  cheque_date: string | null
  /** When to deposit it (regular) or review it (security). */
  due_date: string
  status: ReceivedStatus
  deposit_account_id: string | null
  deposited_on: string | null
  cleared_on: string | null
  bounced_on: string | null
  bounce_reason: string | null
  /** Charges from bounces, added up. */
  bank_charges: number | null
  settled_on: string | null
  settled_via: SettlementMethod | null
  settlement_ref: string | null
  /** Why it was handed back or written off. */
  close_reason: string | null
  redeposit_count: number
  /** The cheque this one replaced. */
  replaces_id: string | null
  series_id: string | null
  series_index: number | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  party?: Party
  deposit_account?: BankAccount | null
}

export interface ReceivedChequeHistory {
  id: string
  cheque_id: string
  from_status: ReceivedStatus
  to_status: ReceivedStatus
  changed_by: 'manual' | 'auto' | 'rollback'
  note: string | null
  reverts_history_id: string | null
  created_at: string
}

export const RECEIVED_STATUS_LABELS: Record<ReceivedStatus, string> = {
  IN_HAND: 'In hand',
  DEPOSITED: 'In clearing',
  CLEARED: 'Cleared',
  BOUNCED: 'Bounced',
  SETTLED: 'Settled',
  HANDED_BACK: 'Handed back',
  WRITTEN_OFF: 'Written off',
  REPLACED: 'Replaced',
}

export const RECEIVED_ACTION_LABELS: Record<ReceivedAction, string> = {
  deposit: 'Deposit',
  clear: 'Mark cleared',
  bounce: 'Mark bounced',
  redeposit: 'Deposit again',
  settle: 'Paid another way',
  hand_back: 'Hand back',
  write_off: 'Write off',
  replace: 'Replace with a new cheque',
}

export const SETTLEMENT_METHOD_LABELS: Record<SettlementMethod, string> = {
  CASH: 'Cash',
  TRANSFER: 'Bank or online transfer',
  OTHER: 'Other',
}

/**
 * What can be done to a cheque in each status. Mirrors the checks in the SQL
 * functions of migration 012; tests/received.test.ts verifies they agree.
 */
export const RECEIVED_ACTIONS: Record<ReceivedStatus, ReceivedAction[]> = {
  IN_HAND: ['deposit', 'settle', 'hand_back', 'write_off', 'replace'],
  DEPOSITED: ['clear', 'bounce'],
  BOUNCED: ['redeposit', 'settle', 'write_off', 'replace'],
  CLEARED: [],
  SETTLED: [],
  HANDED_BACK: [],
  WRITTEN_OFF: [],
  REPLACED: [],
}

/** Final statuses: nothing more will happen to the cheque, except an undo. */
export const RECEIVED_CLOSED_STATUSES: ReceivedStatus[] = ['CLEARED', 'SETTLED', 'HANDED_BACK', 'WRITTEN_OFF', 'REPLACED']
