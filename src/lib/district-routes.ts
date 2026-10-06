export const DISTRICT_PAGES = [
  'overview',
  'cashbook',
  'transfers',
  'accounts',
  'funds',
  'budgets',
  'members',
  'reports',
  'settings',
] as const

export type DistrictPage = (typeof DISTRICT_PAGES)[number]

export function districtPath(districtId: string, page: DistrictPage = 'overview') {
  return `/district/${encodeURIComponent(districtId)}/${page}`
}

export function districtPageFromPathname(pathname: string): DistrictPage {
  const districtMatch = pathname.match(/^\/district\/[^/]+\/([^/]+)/)
  const financeMatch = pathname.match(/^\/dashboard\/finance\/([^/]+)/)
  const candidate = districtMatch?.[1] ?? financeMatch?.[1]

  if (candidate && (DISTRICT_PAGES as readonly string[]).includes(candidate)) {
    return candidate as DistrictPage
  }

  if (pathname.startsWith('/dashboard/settings')) return 'settings'
  return 'overview'
}

export function canonicalDistrictPathFromLegacy(pathname: string, districtId: string) {
  if (pathname === '/dashboard/overview') return districtPath(districtId, 'overview')
  if (pathname === '/dashboard/settings') return districtPath(districtId, 'settings')

  const financeMatch = pathname.match(
    /^\/dashboard\/finance\/(cashbook|transfers|accounts|funds|budgets|members|reports)(\/.*)?$/,
  )
  if (!financeMatch) return null

  const [, page, suffix = ''] = financeMatch
  return `${districtPath(districtId, page as DistrictPage)}${suffix}`
}
