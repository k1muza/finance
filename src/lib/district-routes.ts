export const DISTRICT_PAGES = [
  'summaries/financial',
  'summaries/coordination',
  'calendar',
  'cashbook',
  'transfers',
  'accounts',
  'funds',
  'budgets',
  'regions',
  'assemblies',
  'ministries',
  'members',
  'reports',
  'settings',
] as const

export type DistrictPage = (typeof DISTRICT_PAGES)[number]

/** Landing page for a district (formerly 'overview', which now redirects here). */
export const DEFAULT_DISTRICT_PAGE: DistrictPage = 'summaries/financial'

export function districtPath(districtId: string, page: DistrictPage = DEFAULT_DISTRICT_PAGE) {
  return `/district/${encodeURIComponent(districtId)}/${page}`
}

export function districtPageFromPathname(pathname: string): DistrictPage {
  const districtMatch = pathname.match(/^\/district\/[^/]+\/([^/]+)(?:\/([^/]+))?/)
  const financeMatch = pathname.match(/^\/dashboard\/finance\/([^/]+)/)
  // Nested pages (e.g. summaries/financial) take precedence over their first segment.
  const candidates = districtMatch
    ? [districtMatch[2] ? `${districtMatch[1]}/${districtMatch[2]}` : null, districtMatch[1]]
    : [financeMatch?.[1]]

  for (const candidate of candidates) {
    if (candidate && (DISTRICT_PAGES as readonly string[]).includes(candidate)) {
      return candidate as DistrictPage
    }
  }

  if (pathname.startsWith('/dashboard/settings')) return 'settings'
  return DEFAULT_DISTRICT_PAGE
}

export function canonicalDistrictPathFromLegacy(pathname: string, districtId: string) {
  if (pathname === '/dashboard/overview') return districtPath(districtId, 'summaries/financial')
  if (pathname === '/dashboard/settings') return districtPath(districtId, 'settings')

  const financeMatch = pathname.match(
    /^\/dashboard\/finance\/(cashbook|transfers|accounts|funds|budgets|members|reports)(\/.*)?$/,
  )
  if (!financeMatch) return null

  const [, page, suffix = ''] = financeMatch
  return `${districtPath(districtId, page as DistrictPage)}${suffix}`
}
