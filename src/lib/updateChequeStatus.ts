import { supabase } from './supabase'
import type { ChequeStatus, UpdateChequeStatusOptions } from '@/types'

export async function updateChequeStatus(
  chequeId: string,
  newStatus: ChequeStatus,
  options: UpdateChequeStatusOptions
): Promise<{ success: boolean; error?: string }> {
  const { data: cheque, error: fetchError } = await supabase
    .from('cheques')
    .select('status, return_reason')
    .eq('id', chequeId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !cheque) {
    return { success: false, error: fetchError?.message ?? 'Cheque not found' }
  }

  const fromStatus = cheque.status as ChequeStatus

  if (fromStatus === newStatus) {
    return { success: true }
  }

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (options.changedBy === 'manual' || options.changedBy === 'deposit_allocation') {
    updatePayload.auto_transition_blocked = true
  }

  if (newStatus === 'RETURNED' && options.returnReason) {
    updatePayload.return_reason = options.returnReason
  }

  const { error: updateError } = await supabase
    .from('cheques')
    .update(updatePayload)
    .eq('id', chequeId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  const { error: historyError } = await supabase.from('cheque_history').insert({
    cheque_id: chequeId,
    from_status: fromStatus,
    to_status: newStatus,
    changed_by: options.changedBy,
    note: options.note ?? null,
  })

  if (historyError) {
    return { success: false, error: historyError.message }
  }

  return { success: true }
}

export async function updateChequeStatusBatch(
  chequeIds: string[],
  newStatus: ChequeStatus,
  options: UpdateChequeStatusOptions
): Promise<{ success: boolean; error?: string; count: number }> {
  let count = 0
  for (const id of chequeIds) {
    const result = await updateChequeStatus(id, newStatus, options)
    if (!result.success) {
      return { success: false, error: result.error, count }
    }
    count++
  }
  return { success: true, count }
}
