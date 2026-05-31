import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Daily job — for each user, looks at every PENDING / DEPOSITED cheque whose
 * due_date <= today and auto_transition_blocked = false, then either:
 *
 *   - auto_pass_enabled = true  → marks the cheque PASSED (history row written)
 *   - auto_pass_enabled = false → rolls the cheque's due_date forward by 1 day
 *                                  (no status change, no history row — the
 *                                  cheque simply re-surfaces tomorrow)
 *
 * The job still respects auto_pass_time: it runs only after the user's
 * configured cutoff time has passed locally.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]

  const { data: allSettings } = await supabase.from('settings').select('*')

  let totalPassed = 0
  let totalRolled = 0

  for (const settings of allSettings ?? []) {
    const autoPassTime = settings.auto_pass_time ?? '23:59:00'
    const [hours, minutes] = autoPassTime.split(':').map(Number)
    const now = new Date()
    const passTime = new Date()
    passTime.setHours(hours, minutes, 0, 0)

    if (now < passTime) continue

    const { data: cheques } = await supabase
      .from('cheques')
      .select('id, status')
      .eq('user_id', settings.user_id)
      .in('status', ['PENDING', 'DEPOSITED'])
      .lte('due_date', today)
      .eq('auto_transition_blocked', false)
      .is('deleted_at', null)

    // Treat missing column as "enabled" so behavior is unchanged for users
    // whose row predates the auto_pass_enabled migration.
    const autoPassEnabled = settings.auto_pass_enabled !== false

    for (const cheque of cheques ?? []) {
      if (autoPassEnabled) {
        const { data: current } = await supabase
          .from('cheques')
          .select('status')
          .eq('id', cheque.id)
          .single()

        if (!current) continue

        await supabase
          .from('cheques')
          .update({ status: 'PASSED', updated_at: new Date().toISOString() })
          .eq('id', cheque.id)

        await supabase.from('cheque_history').insert({
          cheque_id: cheque.id,
          from_status: current.status,
          to_status: 'PASSED',
          changed_by: 'auto',
          note: `Scheduled auto-pass on ${today}`,
        })

        totalPassed++
      } else {
        // Roll the cheque forward by one day. We deliberately bump the
        // due_date to "tomorrow" relative to NOW (not just +1 from the
        // existing due_date) so a cheque whose due_date was, say, 5 days
        // ago doesn't roll forward 5 times in one night — it just resurfaces
        // on the next business day until the user processes it.
        await supabase
          .from('cheques')
          .update({ due_date: tomorrow, updated_at: new Date().toISOString() })
          .eq('id', cheque.id)

        totalRolled++
      }
    }
  }

  return new Response(
    JSON.stringify({ passed: totalPassed, rolled_forward: totalRolled }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
