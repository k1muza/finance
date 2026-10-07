import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  requireDistrictActionMock,
  canViewPrivateFinancialsMock,
  createServerClientMock,
  hydrateTransactionPartiesMock,
} = vi.hoisted(() => ({
  requireDistrictActionMock: vi.fn(),
  canViewPrivateFinancialsMock: vi.fn(),
  createServerClientMock: vi.fn(),
  hydrateTransactionPartiesMock: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  requireDistrictAction: requireDistrictActionMock,
  canViewPrivateFinancials: canViewPrivateFinancialsMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('@/lib/finance/transaction-server', () => ({
  hydrateTransactionParties: hydrateTransactionPartiesMock,
}))

import { GET as listTransactions } from '@/app/api/cashbook/transactions/route'

/** Records the query the route builds so the visibility filter can be asserted. */
function createListSupabase() {
  const calls = { select: [] as string[], eq: [] as Array<[string, unknown]> }
  const builder = {
    select(columns: string) { calls.select.push(columns); return builder },
    eq(column: string, value: unknown) { calls.eq.push([column, value]); return builder },
    order() { return builder },
    range() { return builder },
    gte() { return builder },
    lte() { return builder },
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled)
    },
  }
  return { calls, from: () => builder }
}

function listRequest() {
  return new NextRequest('http://localhost/api/cashbook/transactions?district_id=district-1', {
    headers: { Authorization: 'Bearer token-123' },
  })
}

describe('cashbook transaction list route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireDistrictActionMock.mockResolvedValue({ user: { id: 'user-1' }, role: 'assembly_secretary', isSuperuser: false })
    hydrateTransactionPartiesMock.mockImplementation(async (_supabase, rows) => rows)
  })

  it('limits public-only roles to transactions on public funds', async () => {
    const supabase = createListSupabase()
    createServerClientMock.mockReturnValue(supabase)
    canViewPrivateFinancialsMock.mockReturnValue(false)

    const response = await listTransactions(listRequest())

    expect(response.status).toBe(200)
    expect(supabase.calls.select[0]).toContain('fund:funds!inner(id,name,is_public)')
    expect(supabase.calls.eq).toContainEqual(['fund.is_public', true])
  })

  it('returns every fund to roles with private financials', async () => {
    const supabase = createListSupabase()
    createServerClientMock.mockReturnValue(supabase)
    canViewPrivateFinancialsMock.mockReturnValue(true)

    await listTransactions(listRequest())

    expect(supabase.calls.select[0]).not.toContain('!inner')
    expect(supabase.calls.eq).not.toContainEqual(['fund.is_public', true])
  })
})
