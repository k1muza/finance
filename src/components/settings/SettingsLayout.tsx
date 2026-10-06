'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { Bell, Building2, ShieldAlert, UserCog } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSpinner } from '@/components/ui/Spinner'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { DistrictAction } from '@/lib/auth/permissions'
import { districtPath } from '@/lib/district-routes'
import { cn } from '@/lib/utils/cn'
import { navItemClass, navTabClass } from '@/components/layout/nav-styles'

export type SettingsSectionSlug = 'general' | 'users' | 'preferences' | 'danger'

interface SettingsSection {
  slug: SettingsSectionSlug
  label: string
  group: 'District' | 'Personal' | 'Platform'
  icon: typeof Bell
  /** District sections need an active district and, optionally, a permission. */
  district?: boolean
  requires?: DistrictAction
  superuserOnly?: boolean
}

const SECTIONS: SettingsSection[] = [
  { slug: 'general', label: 'General', group: 'District', icon: Building2, district: true, requires: 'district.settings.manage' },
  { slug: 'users', label: 'Users & roles', group: 'District', icon: UserCog, district: true, requires: 'district.users.manage' },
  { slug: 'preferences', label: 'Preferences', group: 'Personal', icon: Bell },
  { slug: 'danger', label: 'Danger zone', group: 'Platform', icon: ShieldAlert, superuserOnly: true },
]

export function settingsPath(districtId: string | null, slug: SettingsSectionSlug) {
  return districtId ? `${districtPath(districtId, 'settings')}/${slug}` : '/dashboard/settings'
}

/** Settings sections this user can open, in menu order. */
export function useSettingsSections() {
  const { districtId } = useAuth()
  const { can, isSuperuser } = usePermissions()

  return SECTIONS.filter((section) => {
    if (section.superuserOnly && !isSuperuser) return false
    // Without a district only Preferences has a page (/dashboard/settings).
    if (!districtId) return section.slug === 'preferences'
    if (section.requires && !can(section.requires)) return false
    return true
  }).map((section) => ({ ...section, href: settingsPath(districtId, section.slug) }))
}

function SettingsNav() {
  const pathname = usePathname()
  const sections = useSettingsSections()
  const groups = [...new Set(sections.map((s) => s.group))]

  return (
    <nav aria-label="Settings" className="md:w-52 md:shrink-0">
      {/* Phones: one scrollable row of tabs */}
      <div className="-mx-6 flex gap-1 overflow-x-auto border-b px-6 pb-2 md:hidden [border-color:var(--border-subtle)]">
        {sections.map(({ slug, href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={slug}
              href={href}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                navTabClass(active)
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </div>

      {/* Tablet and up: grouped vertical menu */}
      <div className="hidden space-y-5 md:block">
        {groups.map((group) => (
          <div key={group} className="space-y-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{group}</p>
            {sections.filter((s) => s.group === group).map(({ slug, href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={slug}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                    navItemClass(active)
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}

export function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader title="Settings" description="District configuration, people and access, and your own preferences." />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <SettingsNav />
        <div className="min-w-0 flex-1 space-y-6">{children}</div>
      </div>
    </div>
  )
}

/** Renders a section only for users allowed to open it. */
export function SettingsSectionGate({ slug, children }: { slug: SettingsSectionSlug; children: ReactNode }) {
  const { districtId, loading } = useAuth()
  const sections = useSettingsSections()

  if (loading) return <PageSpinner />
  if (sections.some((s) => s.slug === slug)) return <>{children}</>

  const section = SECTIONS.find((s) => s.slug === slug)
  if (section?.district && !districtId) {
    return <SelectDistrictHint description="Choose a district from the top bar to manage its settings." />
  }
  return (
    <SelectDistrictHint
      title="Not available for your role"
      description={section?.superuserOnly
        ? 'Only platform administrators can open this section.'
        : 'Ask a District Admin if you need access to this section.'}
    />
  )
}

/** /settings with no section: open the first one this user can see. */
export function SettingsIndexRedirect() {
  const router = useRouter()
  const { loading } = useAuth()
  const first = useSettingsSections()[0]

  useEffect(() => {
    if (!loading && first) router.replace(first.href)
  }, [first, loading, router])

  return <PageSpinner />
}
