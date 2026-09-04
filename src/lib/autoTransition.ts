import { format, parseISO } from 'date-fns'
import { supabase } from './supabase'
import { updateChequeStatus } from './updateChequeStatus'
import { todayISO } from './formatters'

/**
 * Client-side auto-transition — runs once on page load.
 *
 * When auto_pass_enabled = true:
 *   Only auto-passes DEPOSITED cheques whose due_date <= today.
 *   PENDING cheques are NOT auto-passed — they stay pending with an
 *   "Overdue" tag in the dashboard.
 *
 * When auto_pass_enabled = false (default):
 *   Does nothing. No date rolling, no status changes.
 */
export async function runAutoTransition(): Promise<number> {
  const today = todayISO()

  const { data: settings } = await supabase
    .from('settings')
    .select('auto_pass_time, auto_pass_enabled')
    .single()

  // Default off — do nothing unless explicitly enabled
  if (settings?.auto_pass_enabled === false || !settings?.auto_pass_enabled) {
    return 0
  }

  const autoPassTime = settings?.auto_pass_time ?? '23:59:00'
  const [hours, minutes] = autoPassTime.split(':').map(Number)
  const now = new Date()
  const passTime = new Date()
  passTime.setHours(hours, minutes, 0, 0)

  if (now < passTime) {
    return 0
  }

  // Only auto-pass DEPOSITED cheques (not PENDING)
  const { data: cheques, error } = await supabase
    .from('cheques')
    .select('id, status, due_date')
    .eq('status', 'DEPOSITED')
    .lte('due_date', today)
    .eq('auto_transition_blocked', false)
    .is('deleted_at', null)

  if (error || !cheques?.length) {
    return 0
  }

  let transitioned = 0
  for (const cheque of cheques) {
    const result = await updateChequeStatus(cheque.id, 'PASSED', {
      changedBy: 'auto',
      note: `Auto-passed on ${format(parseISO(today), 'dd-MM-yyyy')}`,
    })
    if (result.success) transitioned++
  }

  return transitioned
}
