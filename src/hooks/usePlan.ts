import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Entitlement } from '@/types'

export interface PlanState {
  loading: boolean
  /** Off on self-hosted instances: every feature is free and there are no plans. */
  billingEnabled: boolean
  /** Whether the user can add and change data. Always true when billing is off. */
  hasAccess: boolean
  /** The active entitlement that lasts longest, if any. */
  current: Entitlement | null
}

function isActive(e: Entitlement, now: number): boolean {
  return Date.parse(e.starts_at) <= now && (!e.expires_at || Date.parse(e.expires_at) > now)
}

/** Grants that never expire first, then the one that runs longest. */
function lastsLonger(a: Entitlement, b: Entitlement): number {
  if (!a.expires_at) return -1
  if (!b.expires_at) return 1
  return Date.parse(b.expires_at) - Date.parse(a.expires_at)
}

/** Whole days until an entitlement ends (at least 0). */
export function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000))
}

/**
 * The signed-in user's plan. See docs/editions.md. The database enforces it
 * too (has_write_access): this hook only decides what to show.
 */
export function usePlan(): PlanState {
  const [state, setState] = useState<PlanState>({
    loading: true,
    billingEnabled: false,
    hasAccess: true,
    current: null,
  })

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.from('instance_config').select('billing_enabled').maybeSingle(),
      supabase.from('entitlements').select('*'),
    ]).then(([configRes, entitlementsRes]) => {
      if (cancelled) return
      // A database without the editions migration behaves like a self-hosted one.
      const billingEnabled = !configRes.error && !!configRes.data?.billing_enabled
      const now = Date.now()
      const active = ((entitlementsRes.data ?? []) as Entitlement[])
        .filter((e) => isActive(e, now))
        .sort(lastsLonger)
      const current = active[0] ?? null
      setState({ loading: false, billingEnabled, hasAccess: !billingEnabled || !!current, current })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
