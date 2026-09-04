import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Settings, AllocationSort } from '@/types'

const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  auto_pass_time: '23:59:00',
  auto_pass_enabled: false,
  currency_symbol: '₹',
  allocation_sort: 'due_date_asc',
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    let { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      const { data: newSettings } = await supabase
        .from('settings')
        .insert({ user_id: user.id, ...DEFAULT_SETTINGS })
        .select()
        .single()
      data = newSettings
    }

    if (data) setSettings(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (updates: {
    auto_pass_time?: string
    auto_pass_enabled?: boolean
    currency_symbol?: string
    allocation_sort?: AllocationSort
  }) => {
    if (!settings) return { error: 'No settings found' }

    const { error } = await supabase
      .from('settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', settings.id)

    if (!error) await fetchSettings()
    return { error: error?.message }
  }

  return {
    settings,
    loading,
    currencySymbol: settings?.currency_symbol ?? '₹',
    allocationSort: settings?.allocation_sort ?? 'due_date_asc',
    updateSettings,
    fetchSettings,
  }
}
