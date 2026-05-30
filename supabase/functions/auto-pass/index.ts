import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const today = new Date().toISOString().split('T')[0]

  const { data: allSettings } = await supabase.from('settings').select('*')

  let totalTransitioned = 0

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

    for (const cheque of cheques ?? []) {
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

      totalTransitioned++
    }
  }

  return new Response(
    JSON.stringify({ transitioned: totalTransitioned }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
