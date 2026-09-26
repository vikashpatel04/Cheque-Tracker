import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// The shop operates in India; due dates and auto_pass_time are IST wall-clock
// values, while the edge runtime runs in UTC.
const TIME_ZONE = 'Asia/Kolkata'

/** Current date (yyyy-MM-dd), display date (dd/MM/yyyy) and minutes since midnight in TIME_ZONE. */
function nowInTimeZone() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  )
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    displayDate: `${parts.day}/${parts.month}/${parts.year}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

/**
 * Scheduled job — for each user with auto_pass_enabled, once the IST time is
 * past their auto_pass_time, marks every DEPOSITED cheque whose due_date is
 * on or before today (IST) as PASSED.
 *
 * PENDING cheques are NEVER auto-passed. Dates are NEVER changed.
 * Each transition goes through change_cheque_status(), which updates the
 * cheque and writes the history row atomically.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const now = nowInTimeZone()

  const { data: allSettings, error: settingsError } = await supabase
    .from('settings')
    .select('user_id, auto_pass_enabled, auto_pass_time')
    .eq('auto_pass_enabled', true)

  if (settingsError) {
    return new Response(JSON.stringify({ error: settingsError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let totalPassed = 0
  const errors: string[] = []

  for (const settings of allSettings ?? []) {
    const [hours, minutes] = (settings.auto_pass_time ?? '23:59:00').split(':').map(Number)
    if (now.minutes < hours * 60 + minutes) continue

    const { data: cheques, error } = await supabase
      .from('cheques')
      .select('id')
      .eq('user_id', settings.user_id)
      .eq('status', 'DEPOSITED')
      .lte('due_date', now.isoDate)
      .eq('auto_transition_blocked', false)
      .is('deleted_at', null)

    if (error) {
      errors.push(error.message)
      continue
    }

    for (const cheque of cheques ?? []) {
      const { error: rpcError } = await supabase.rpc('change_cheque_status', {
        p_cheque_id: cheque.id,
        p_new_status: 'PASSED',
        p_changed_by: 'auto',
        p_note: `Scheduled auto-pass on ${now.displayDate}`,
      })
      if (rpcError) errors.push(`${cheque.id}: ${rpcError.message}`)
      else totalPassed++
    }
  }

  return new Response(
    JSON.stringify({ passed: totalPassed, date: now.isoDate, errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
