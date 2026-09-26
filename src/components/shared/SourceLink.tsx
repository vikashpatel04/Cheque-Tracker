import { cn } from '@/lib/utils'
import { brand } from '@/config/brand'

/**
 * Link to this deployment's source code. The AGPL (section 13) asks every
 * network service running the code to offer its source, so it's shown on the
 * sign-in page and in the sidebar. Forks set VITE_SOURCE_URL to their repo.
 */
export function SourceLink({ className }: { className?: string }) {
  return (
    <a
      href={brand.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={cn('text-xs text-muted-foreground hover:text-foreground hover:underline', className)}
    >
      Open source ({brand.license}) · Source code
    </a>
  )
}
