'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/AuthContext'
import {
  BarChart3,
  Settings2,
  Menu,
  X,
  Landmark,
  Sun,
  Moon,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  PiggyBank,
  ReceiptText,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const baseNav = [
  { href: '/dashboard/overview', icon: BarChart3, label: 'Overview' },
  { href: '/dashboard/finance/income', icon: PiggyBank, label: 'Income' },
  { href: '/dashboard/finance/expenditure', icon: ReceiptText, label: 'Expenditure' },
  { href: '/dashboard/finance/reports', icon: FileText, label: 'Reports' },
  { href: '/dashboard/settings', icon: Settings2, label: 'Settings' },
]

const adminNav: typeof baseNav = []

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'flex items-center rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors w-full',
        collapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'
      )}
    >
      {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {!collapsed && <span>{isDark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}

function DistrictBadge({ collapsed }: { collapsed: boolean }) {
  const { district, isAdmin, activeDistrictId } = useAuth()
  if (collapsed) return null
  if (isAdmin) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
        <ShieldCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
        <span className="text-xs text-cyan-400 font-medium truncate">
          {activeDistrictId ? 'Admin · District view' : 'Admin · All districts'}
        </span>
      </div>
    )
  }
  if (district) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-700">
        <p className="text-xs text-slate-400 leading-none mb-0.5">District</p>
        <p className="text-xs font-semibold text-slate-200 truncate">{district.name}</p>
      </div>
    )
  }
  return null
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const { isAdmin, user, logout } = useAuth()

  const handleMobileLogout = async () => {
    setMobileOpen(false)
    await logout()
    router.push('/login')
  }

  useEffect(() => {
    const update = () => setCollapsed(window.innerWidth < 1024)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const nav = [...baseNav, ...(isAdmin ? adminNav : [])]

  const desktopLinks = (
    <nav className="flex flex-col gap-1 mt-2">
      {nav.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
              active
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Link>
        )
      })}
    </nav>
  )

  const mobileLinks = (
    <nav className="flex flex-col gap-1 mt-2">
      {nav.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              active
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2 text-cyan-400 font-bold">
          <Landmark className="h-6 w-6" />
          <span className="text-slate-100">Finance</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-slate-400 hover:text-slate-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-slate-900 border-r border-slate-700 p-4 flex flex-col h-full overflow-y-auto">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-3">
              <Landmark className="h-6 w-6" />
              <span className="text-slate-100">Finance</span>
            </div>
            <div className="mb-4">
              <DistrictBadge collapsed={false} />
            </div>
            {mobileLinks}
            <div className="mt-auto pt-4 border-t border-slate-700 space-y-1">
              <ThemeToggle collapsed={false} />
              {user?.email && (
                <p className="px-3 py-1 text-xs text-slate-500 truncate">{user.email}</p>
              )}
              <button
                type="button"
                onClick={handleMobileLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className={cn(
        'hidden md:flex flex-col shrink-0 bg-slate-900 border-r border-slate-700 h-full overflow-y-auto transition-all duration-200',
        collapsed ? 'w-14 p-2' : 'w-60 p-4'
      )}>
        <div className={cn(
          'flex items-center text-cyan-400 font-bold mb-3',
          collapsed ? 'justify-center' : 'gap-2'
        )}>
          <Landmark className={collapsed ? 'h-6 w-6' : 'h-7 w-7'} />
          {!collapsed && <span className="text-slate-100 text-lg">Finance</span>}
        </div>

        {!collapsed && (
          <div className="mb-4">
            <DistrictBadge collapsed={collapsed} />
          </div>
        )}

        {desktopLinks}

        <div className="mt-auto pt-4 border-t border-slate-700 space-y-1">
          <ThemeToggle collapsed={collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex items-center rounded-lg text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors w-full',
              collapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronLeft className="h-4 w-4 shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
