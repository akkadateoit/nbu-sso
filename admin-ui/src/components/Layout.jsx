import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Users, ScrollText, LogOut, ShieldCheck, Database } from 'lucide-react'
import { getCurrentUser, clearToken, redirectToLogin } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/',          label: 'Dashboard',       icon: LayoutDashboard, end: true },
  { to: '/apps',      label: 'Apps',            icon: Package },
  { to: '/users',     label: 'Users',           icon: Users },
  { to: '/master',    label: 'Role & Scope',    icon: Database },
  { to: '/audit',     label: 'Audit Log',       icon: ScrollText },
]

export default function Layout() {
  const navigate  = useNavigate()
  const user      = getCurrentUser()

  useEffect(() => {
    if (!user) redirectToLogin()
  }, [user])

  function handleLogout() {
    clearToken()
    redirectToLogin()
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
            <div>
              <p className="font-bold text-sm leading-none">NBU SSO</p>
              <p className="text-xs text-slate-400 mt-0.5">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white')
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
              {user.name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full text-slate-300 hover:text-white hover:bg-slate-800" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
