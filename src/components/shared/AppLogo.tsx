import { cn } from '@/lib/utils'
import { brand } from '@/config/brand'

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
} as const

interface AppLogoProps {
  size?: keyof typeof sizeClasses
  showText?: boolean
  className?: string
}

export function AppLogo({ size = 'md', showText = true, className }: AppLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src="/cheque.png"
        alt={showText ? '' : brand.name}
        aria-hidden={showText}
        className={cn(sizeClasses[size], 'object-contain shrink-0')}
      />
      {showText && <p className="text-lg font-bold tracking-tight leading-tight">{brand.name}</p>}
    </div>
  )
}
