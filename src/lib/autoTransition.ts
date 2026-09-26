import { supabase } from './supabase'
import { updateChequeStatus } from './updateChequeStatus'
import { nowInUserTimeZone, todayISO } from './formatters'
import type { Settings } from '@/types'

/**
 * Client-side auto-transition — runs once per visit, after the user's
 * settings (and so their time zone) have loaded. The auto-pass Edge Function
 * does the same on a schedule; this covers instances that don't deploy it.
 *
 * When auto_pass_enabled = true:
 *   Once the user's local time is past auto_pass_time, DEPOSITED (funded)
 *   cheques whose due_date is on or before today are marked PASSED.
 *   PENDING cheques are NOT auto-passed — they stay pending with an
 *   "Overdue" tag in the dashboard.
 *
 * When auto_pass_enabled = false (default):
 *   Does nothing. No date rolling, no status changes.
 */
export async function runAutoTransition(
  settings: Pick<Settings, 'auto_pass_enabled' | 'auto_pass_time'>
): Promise<number> {
  if (!settings.auto_pass_enabled) return 0

  const [hours, minutes] = (settings.auto_pass_time ?? '23:59:00').split(':').map(Number)
  const now = nowInUserTimeZone()
  if (now.getHours() * 60 + now.getMinutes() < hours * 60 + minutes) return 0

  const today = todayISO()
  const { data: cheques, error } = await supabase
    .from('cheques')
    .select('id')
    .eq('status', 'DEPOSITED')
    .lte('due_date', today)
    .eq('auto_transition_blocked', false)
    .is('deleted_at', null)

  if (error || !cheques?.length) return 0

  let transitioned = 0
  for (const cheque of cheques) {
    const result = await updateChequeStatus(cheque.id, 'PASSED', {
      changedBy: 'auto',
      // ISO date so the note reads correctly in every date format.
      note: `Auto-passed on ${today}`,
    })
    if (result.success) transitioned++
  }

  return transitioned
}
