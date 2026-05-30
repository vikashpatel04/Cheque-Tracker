import { format, parseISO } from 'date-fns'
import { supabase } from './supabase'
import { updateChequeStatus } from './updateChequeStatus'
import { todayISO } from './formatters'

export async function runAutoTransition(): Promise<number> {
  const today = todayISO()

  const { data: settings } = await supabase
    .from('settings')
    .select('auto_pass_time')
    .single()

  const autoPassTime = settings?.auto_pass_time ?? '23:59:00'
  const [hours, minutes] = autoPassTime.split(':').map(Number)
  const now = new Date()
  const passTime = new Date()
  passTime.setHours(hours, minutes, 0, 0)

  if (now < passTime) {
    return 0
  }

  const { data: cheques, error } = await supabase
    .from('cheques')
    .select('id, status, due_date')
    .in('status', ['PENDING', 'DEPOSITED'])
    .lte('due_date', today)
    .eq('auto_transition_blocked', false)
    .is('deleted_at', null)

  if (error || !cheques?.length) {
    return 0
  }

  let transitioned = 0
  for (const cheque of cheques) {
    if (cheque.status === 'DEPOSITED' || cheque.status === 'PENDING') {
      const result = await updateChequeStatus(cheque.id, 'PASSED', {
        changedBy: 'auto',
        note: `Auto-passed on ${format(parseISO(today), 'dd-MM-yyyy')}`,
      })
      if (result.success) transitioned++
    }
  }

  return transitioned
}
