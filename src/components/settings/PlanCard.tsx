import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePlan } from '@/hooks/usePlan'
import { formatDate } from '@/lib/formatters'
import type { Entitlement } from '@/types'

function describe(current: Entitlement): string {
  if (!current.expires_at) return 'Active, with no end date.'
  const until = formatDate(current.expires_at)
  return current.source === 'trial' ? `Free trial, ends ${until}.` : `Active until ${until}.`
}

/** The user's plan on instances with billing on. Hidden on self-hosted instances. */
export function PlanCard() {
  const plan = usePlan()
  if (plan.loading || !plan.billingEnabled) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
        <CardDescription>
          {plan.current
            ? describe(plan.current)
            : 'No active plan. Your account is read-only: everything stays visible and can be exported.'}
        </CardDescription>
      </CardHeader>
      {plan.current?.note && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{plan.current.note}</p>
        </CardContent>
      )}
    </Card>
  )
}
