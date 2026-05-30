import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Users,
  RotateCcw,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { DepositWidget } from '@/components/deposit/DepositWidget'
import { AppLogo } from '@/components/shared/AppLogo'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cheques', label: 'Cheques', icon: FileText },
  { to: '/parties', label: 'Parties', icon: Users },
  { to: '/returned', label: 'Returned', icon: RotateCcw },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <AppLogo size="sm" className="min-w-0 flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-11 w-11 shrink-0"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onMobileClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 min-h-[44px]"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 backdrop-blur px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-11 w-11 shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <DepositWidget />
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
