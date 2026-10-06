import { describe, expect, it } from 'vitest'
import {
  canonicalDistrictPathFromLegacy,
  districtPageFromPathname,
  districtPath,
} from '@/lib/district-routes'

describe('district routes', () => {
  it('builds canonical district page paths', () => {
    expect(districtPath('district-1', 'accounts')).toBe('/district/district-1/accounts')
  })

  it('preserves finance detail suffixes when canonicalizing legacy paths', () => {
    expect(canonicalDistrictPathFromLegacy(
      '/dashboard/finance/funds/fund-1/leaderboard',
      'district-1',
    )).toBe('/district/district-1/funds/fund-1/leaderboard')
  })

  it('derives the current page when switching districts', () => {
    expect(districtPageFromPathname('/district/district-1/budgets/budget-1')).toBe('budgets')
    expect(districtPageFromPathname('/dashboard/settings')).toBe('settings')
  })
})
