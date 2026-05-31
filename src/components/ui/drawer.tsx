/**
 * ResponsiveDrawer
 *
 * On mobile (< sm breakpoint):  Vaul bottom-sheet — spring physics, drag
 *   handle, drag-to-dismiss, elastic overscroll. Same feel as shadcn's Drawer.
 *
 * On desktop (sm+):  Regular Radix Sheet from the right — unchanged.
 *
 * Usage — drop-in replacement for the Sheet pattern:
 *
 *   <ResponsiveDrawer open={open} onOpenChange={setOpen} title="Edit Cheque">
 *     {content}
 *   </ResponsiveDrawer>
 */
import * as React from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface ResponsiveDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Extra classes applied to the scroll container on both mobile and desktop. */
  className?: string
  children: React.ReactNode
}

/**
 * Detects whether we're on a sm+ screen at render time.
 * We deliberately avoid a media-query hook — a simple window check is cheaper
 * and the component re-mounts on resize anyway.
 */
function isDesktop() {
  return typeof window !== 'undefined' && window.innerWidth >= 640
}

export function ResponsiveDrawer({
  open,
  onOpenChange,
  title,
  className,
  children,
}: ResponsiveDrawerProps) {
  const [desktop, setDesktop] = React.useState(isDesktop)

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const handler = (e: MediaQueryListEvent) => setDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /* ------------------------------------------------------------------ */
  /* Desktop — keep the existing right-side Sheet experience              */
  /* ------------------------------------------------------------------ */
  if (desktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className={cn('overflow-y-auto', className)}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  /* ------------------------------------------------------------------ */
  /* Mobile — Vaul bottom-sheet with spring animation + drag handle      */
  /* ------------------------------------------------------------------ */
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        {/* Backdrop */}
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />

        {/* Panel */}
        <Drawer.Content
          className={cn(
            // Positioning
            'fixed inset-x-0 bottom-0 z-50',
            // Size
            'max-h-[90svh]',
            // Shape
            'flex flex-col rounded-t-2xl border-t',
            // Colours
            'bg-background shadow-xl',
          )}
        >
          {/* Drag handle — required by vaul for accessibility */}
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <Drawer.Title className="text-lg font-semibold leading-none tracking-tight">
              {title}
            </Drawer.Title>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className={cn('flex-1 overflow-y-auto px-5 pb-6', className)}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
