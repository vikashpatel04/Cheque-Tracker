import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/formatters'
import type { DailyDeposit } from '@/types'

export function useDeposits() {
  const [todayTotal, setTodayTotal] = useState(0)
  const [deposits, setDeposits] = useState<DailyDeposit[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTodayTotal = useCallback(async () => {
    const today = todayISO()
    const { data } = await supabase
      .from('daily_deposits')
      .select('amount')
      .eq('deposit_date', today)

    const total = (data ?? []).reduce((sum, d) => sum + Number(d.amount), 0)
    setTodayTotal(total)
  }, [])

  const fetchAllDeposits = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('daily_deposits')
      .select('*')
      .order('deposit_date', { ascending: false })

    if (data) setDeposits(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTodayTotal()
    fetchAllDeposits()
  }, [fetchTodayTotal, fetchAllDeposits])

  const addDeposit = async (amount: number, notes?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('daily_deposits')
      .insert({
        user_id: user.id,
        amount,
        deposit_date: todayISO(),
        notes: notes ?? null,
      })
      .select()
      .single()

    if (!error) {
      await fetchTodayTotal()
      await fetchAllDeposits()
    }
    return { data, error: error?.message }
  }

  return { todayTotal, deposits, loading, addDeposit, fetchTodayTotal, fetchAllDeposits }
}
