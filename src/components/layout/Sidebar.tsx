'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UiSettingsButton } from '@/components/layout/UiSettingsButton'
import { useSidebarState } from '@/components/layout/SidebarState'
import { usePermissions } from '@/hooks/usePermissions'
import type { DistrictAction } from '@/lib/auth/permissions'
import {
  BarChart3,
  Settings2,
  Menu,
  X,
  Landmark,
  LogOut,
  FileText,
  BookOpen,
  Wallet,
  Users,
  ArrowRightLeft,
  Target,
  Banknote,
  Library,
  Contact,
  ChevronDown,
  CalendarDays,
  Handshake,
  MapPin,
  Church,
  HandHeart,
  LayoutDashboard,
  CalendarRange,
  Building2,
  Coins,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { navItemClass } from '@/components/layout/nav-styles'
import { districtPath, type DistrictPage } from '@/lib/district-routes'

type NavLink = {
  page: DistrictPage
  /** Where the link goes when no district is selected; omit to hide it until one is. */
  fallbackHref?: string
  icon: typeof BarChart3
  label: string
  /** Only shown to users allowed to perform this action in the active district. */
  requires?: DistrictAction
}

type NavGroup = {
  id: string
  label: string
  icon: typeof BarChart3
  items: NavLink[]
}

type NavEntry = NavLink | NavGroup

const isGroup = (entry: NavEntry): entry is NavGroup => 'items' in entry

const mainNav: NavEntry[] = [
  {
    id: 'summaries',
    label: 'Summaries',
    icon: LayoutDashboard,
    items: [
      { page: 'summaries/financial', fallbackHref: '/dashboard/overview', icon: BarChart3, label: 'Financial Summary' },
      { page: 'summaries/coordination', icon: CalendarRange, label: 'Coordination Summary' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Banknote,
    items: [
      { page: 'cashbook', fallbackHref: '/dashboard/finance/cashbook', icon: BookOpen, label: 'Cashbook', requires: 'transactions.view' },
      { page: 'collections', icon: Coins, label: 'Collections', requires: 'collections.view' },
      { page: 'transfers', fallbackHref: '/dashboard/finance/transfers', icon: ArrowRightLeft, label: 'Transfers', requires: 'transfers.view' },
      { page: 'budgets', fallbackHref: '/dashboard/finance/budgets', icon: Target, label: 'Budgets', requires: 'budgets.view' },
      { page: 'reports', fallbackHref: '/dashboard/finance/reports', icon: FileText, label: 'Reports', requires: 'reports.view' },
    ],
  },
  {
    id: 'ledger',
    label: 'Ledger setup',
    icon: Library,
    items: [
      { page: 'accounts', fallbackHref: '/dashboard/finance/accounts', icon: Landmark, label: 'Accounts', requires: 'financials.view_private' },
      { page: 'funds', fallbackHref: '/dashboard/finance/funds', icon: Wallet, label: 'Funds', requires: 'financials.view_private' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    items: [
      { page: 'regions', icon: MapPin, label: 'Regions' },
      { page: 'assemblies', icon: Church, label: 'Assemblies' },
      { page: 'ministries', icon: HandHeart, label: 'Ministries' },
      { page: 'members', fallbackHref: '/dashboard/finance/members', icon: Contact, label: 'Members' },
    ],
  },
  {
    id: 'coordination',
    label: 'Coordination',
    icon: Handshake,
    items: [
      { page: 'calendar', icon: CalendarDays, label: 'Calendar', requires: 'events.view' },
      { page: 'departments', icon: Building2, label: 'Departments', requires: 'events.view' },
    ],
  },
]

const footerNav: NavLink[] = [
  { page: 'settings', fallbackHref: '/dashboard/settings', icon: Settings2, label: 'Settings' },
]

const GROUPS_STORAGE_KEY = 'sidebar:open-groups'

// Group open/closed state lives in localStorage, read through useSyncExternalStore so the
// server render (everything open) and the client agree on first paint. Desktop and mobile
// trees share it. In-memory fallback keeps toggles working when storage is unavailable.
const EMPTY_GROUPS: Record<string, boolean> = {}
const groupListeners = new Set<() => void>()
let groupSnapshot: Record<string, boolean> | null = null

function getGroupsSnapshot(): Record<string, boolean> {
  if (groupSnapshot) return groupSnapshot
  try {
    const raw = window.localStorage.getItem(GROUPS_STORAGE_KEY)
    groupSnapshot = raw ? JSON.parse(raw) : EMPTY_GROUPS
  } catch {
    groupSnapshot = EMPTY_GROUPS
  }
  return groupSnapshot!
}

function setStoredGroups(value: Record<string, boolean>) {
  groupSnapshot = value
  try {
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode, blocked site data) — state just won't persist.
  }
  groupListeners.forEach((listener) => listener())
}

function subscribeGroups(listener: () => void) {
  groupListeners.add(listener)
  return () => {
    groupListeners.delete(listener)
  }
}

const linkClass = navItemClass

/** Resolves a link's href, or null when the link shouldn't be shown to this user. */
function useNavHref() {
  const { districtId } = useAuth()
  const { can } = usePermissions()
  return (link: NavLink): string | null => {
    if (link.requires && !can(link.requires)) return null
    return districtId ? districtPath(districtId, link.page) : link.fallbackHref ?? null
  }
}

function useIsActive() {
  const pathname = usePathname()
  const hrefFor = useNavHref()
  return (link: NavLink) => {
    const href = hrefFor(link)
    return href !== null && pathname.startsWith(href)
  }
}

function NavItem({
  link,
  collapsed,
  nested,
  onNavigate,
}: {
  link: NavLink
  collapsed: boolean
  nested?: boolean
  onNavigate?: () => void
}) {
  const hrefFor = useNavHref()
  const href = hrefFor(link)
  const active = useIsActive()(link)
  const Icon = link.icon
  if (href === null) return null
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? link.label : undefined}
      className={cn(
        'flex items-center rounded-sm text-sm font-medium transition-colors',
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
        !collapsed && nested && 'pl-5',
        linkClass(active)
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{link.label}</span>}
    </Link>
  )
}

function GroupFlyout({ group, items }: { group: NavGroup; items: NavLink[] }) {
  const pathname = usePathname()
  const isActive = useIsActive()
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const active = items.some(isActive)
  const Icon = group.icon

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setAnchor(null)
  }

  useEffect(() => {
    if (!anchor) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setAnchor(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAnchor(null)
    }
    const close = () => setAnchor(null)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
    }
  }, [anchor])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={group.label}
        aria-label={group.label}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={() => setAnchor((current) => (current ? null : buttonRef.current?.getBoundingClientRect() ?? null))}
        className={cn(
          'flex items-center justify-center rounded-sm py-2.5 transition-colors',
          linkClass(active || anchor !== null)
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
      </button>
      {anchor && (
        // Fixed positioning so the panel isn't clipped by the scrolling <aside>.
        <div
          ref={panelRef}
          role="menu"
          style={{ top: anchor.top, left: anchor.right + 8 }}
          className="fixed z-40 w-48 rounded-sm border border-slate-700 bg-slate-900 p-1.5 shadow-lg"
        >
          <p className="px-3 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {items.map((link) => (
              <NavItem key={link.page} link={link} collapsed={false} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function NavTree({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const hrefFor = useNavHref()
  const isActive = useIsActive()
  const storedGroups = useSyncExternalStore(subscribeGroups, getGroupsSnapshot, () => EMPTY_GROUPS)

  const visible = (link: NavLink) => hrefFor(link) !== null
  const groupHasActive = (items: NavLink[]) => items.some(isActive)

  // Navigating into a closed group reveals it so the active link is visible; the user can
  // still close it again, and that choice is what gets persisted.
  const [revealedGroup, setRevealedGroup] = useState<string | null>(null)
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    const activeGroup = mainNav.find((entry) => isGroup(entry) && groupHasActive(entry.items)) as NavGroup | undefined
    setRevealedGroup(activeGroup?.id ?? null)
  }

  const isOpen = (id: string) => storedGroups[id] !== false || revealedGroup === id

  const toggleGroup = (id: string) => {
    if (revealedGroup === id) setRevealedGroup(null)
    setStoredGroups({ ...storedGroups, [id]: !isOpen(id) })
  }

  return (
    <nav className="flex flex-col gap-1 mt-2">
      {mainNav.map((entry) => {
        if (!isGroup(entry)) {
          return visible(entry) ? (
            <NavItem key={entry.page} link={entry} collapsed={collapsed} onNavigate={onNavigate} />
          ) : null
        }

        const items = entry.items.filter(visible)
        if (items.length === 0) return null

        if (collapsed) return <GroupFlyout key={entry.id} group={entry} items={items} />

        const open = isOpen(entry.id)
        return (
          <div key={entry.id} className="flex flex-col gap-0.5 pt-2">
            <button
              type="button"
              onClick={() => toggleGroup(entry.id)}
              aria-expanded={open}
              className={cn(
                'flex items-center justify-between rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-slate-800',
                groupHasActive(items) && !open ? 'text-[var(--text-primary)]' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <span>{entry.label}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !open && '-rotate-90')} />
            </button>
            {open &&
              items.map((link) => (
                <NavItem key={link.page} link={link} collapsed={false} nested onNavigate={onNavigate} />
              ))}
          </div>
        )
      })}
    </nav>
  )
}

function FooterNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      {footerNav.map((link) => (
        <NavItem key={link.page} link={link} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

function DistrictBadge({ collapsed }: { collapsed: boolean }) {
  const { district } = useAuth()
  if (collapsed) return null
  if (district) {
    return (
      <div className="px-3 py-1.5 rounded-sm bg-slate-700/50 border border-slate-700">
        <p className="text-xs text-slate-400 leading-none mb-0.5">District</p>
        <p className="text-xs font-semibold text-slate-200 truncate">{district.name}</p>
      </div>
    )
  }
  return null
}

export function Sidebar() {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { collapsed } = useSidebarState()
  const { user, logout } = useAuth()

  const closeMobile = () => setMobileOpen(false)

  const handleMobileLogout = async () => {
    setMobileOpen(false)
    await logout()
    router.push('/login')
  }

  return (
    <>
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2 text-cyan-400 font-bold">
          <Landmark className="h-6 w-6" />
          <span className="text-slate-100">Finance</span>
        </div>
        <div className="flex items-center gap-2">
          <UiSettingsButton className="h-9 w-9" />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-slate-700 bg-slate-800 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-100"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/60" onClick={closeMobile} />
          <div className="relative w-72 bg-slate-900 border-r border-slate-700 p-4 flex flex-col h-full overflow-y-auto">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-3">
              <Landmark className="h-6 w-6" />
              <span className="text-slate-100">Finance</span>
            </div>
            <div className="mb-4">
              <DistrictBadge collapsed={false} />
            </div>
            <NavTree collapsed={false} onNavigate={closeMobile} />
            <div className="mt-auto pt-4 border-t border-slate-700 space-y-1">
              <FooterNav collapsed={false} onNavigate={closeMobile} />
              {user?.email && (
                <p className="px-3 py-1 text-xs text-slate-500 truncate">{user.email}</p>
              )}
              <button
                type="button"
                onClick={handleMobileLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full"
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

        <NavTree collapsed={collapsed} />

        <div className="mt-auto pt-4 border-t border-slate-700">
          <FooterNav collapsed={collapsed} />
        </div>
      </aside>
    </>
  )
}
