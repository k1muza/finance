import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireDistrictActionMock,
  createServerClientMock,
  buildPostedTransactionUpdateMock,
  hydrateTransactionPartiesMock,
  loadDistrictWorkflowSettingsMock,
} = vi.hoisted(() => ({
  requireDistrictActionMock: vi.fn(),
  createServerClientMock: vi.fn(),
  buildPostedTransactionUpdateMock: vi.fn(),
  hydrateTransactionPartiesMock: vi.fn(),
  loadDistrictWorkflowSettingsMock: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  requireDistrictAction: requireDistrictActionMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('@/lib/finance/transaction-server', () => ({
  buildPostedTransactionUpdate: buildPostedTransactionUpdateMock,
  hydrateTransactionParties: hydrateTransactionPartiesMock,
  loadDistrictWorkflowSettings: loadDistrictWorkflowSettingsMock,
}))

import { POST as postTransaction } from '@/app/api/cashbook/transactions/[id]/post/route'

function matchesFilters(
  row: Record<string, unknown>,
  filters: Array<{ column: string; value: unknown }>,
) {
  return filters.every((filter) => row[filter.column] === filter.value)
}

function createPostRouteSupabase(transactionRows: Array<Record<string, unknown>>) {
  return {
    from(tableName: string) {
      const filters: Array<{ column: string; value: unknown }> = []
      let updatePayload: Record<string, unknown> | null = null

      const builder = {
        select(_columns?: string) {
          return builder
        },

        eq(column: string, value: unknown) {
          filters.push({ column, value })
          return builder
        },

        update(payload: Record<string, unknown>) {
          updatePayload = payload
          return builder
        },

        async maybeSingle() {
          if (tableName !== 'cashbook_transactions') {
            return { data: null, error: { message: `Unsupported table ${tableName}` } }
          }

          const rows = transactionRows.filter((row) => matchesFilters(row, filters))
          return { data: rows[0] ?? null, error: null }
        },

        async single() {
          if (tableName !== 'cashbook_transactions') {
            return { data: null, error: { message: `Unsupported table ${tableName}` } }
          }

          const rows = transactionRows.filter((row) => matchesFilters(row, filters))
          if (rows.length !== 1) {
            return {
              data: null,
              error: { message: rows.length === 0 ? 'No rows returned' : 'Multiple rows returned' },
            }
          }

          if (updatePayload) {
            Object.assign(rows[0], updatePayload)
          }

          return { data: rows[0], error: null }
        },
      }

      return builder
    },
  }
}

function makeRequest() {
  return new Request('http://localhost/api/cashbook/transactions/txn-1/post', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-123',
    },
  })
}

describe('cashbook post route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hydrateTransactionPartiesMock.mockImplementation(async (_supabase, rows) => rows)
    buildPostedTransactionUpdateMock.mockResolvedValue({
      status: 'posted',
      reference_number: 'TXN-2026-0100',
      posted_by: 'user-1',
      posted_at: '2026-04-23T10:00:00.000Z',
      submitted_by: 'user-1',
      submitted_at: '2026-04-23T10:00:00.000Z',
      approved_by: 'user-1',
      approved_at: '2026-04-23T10:00:00.000Z',
    })
  })

  it('posts approved transactions with posting permission', async () => {
    const supabase = createPostRouteSupabase([
      {
        id: 'txn-1',
        district_id: 'district-1',
        status: 'approved',
        account_id: 'account-1',
        fund_id: 'fund-1',
        member_id: null,
        counterparty_id: null,
        kind: 'receipt',
        effect_direction: 'in',
        transaction_date: '2026-04-23',
        counterparty: 'Brother A',
        narration: 'Offering',
        currency: 'USD',
        total_amount: 50,
      },
    ])
    createServerClientMock.mockReturnValue(supabase)
    loadDistrictWorkflowSettingsMock.mockResolvedValue({
      id: 'district-1',
      auto_post_cashbook_transactions: false,
    })
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'treasurer',
      isSuperuser: false,
    })

    const response = await postTransaction(
      makeRequest() as never,
      { params: Promise.resolve({ id: 'txn-1' }) } as never,
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('posted')
    expect(requireDistrictActionMock).toHaveBeenCalledWith(
      supabase,
      'token-123',
      'district-1',
      'transactions.post',
    )
    expect(buildPostedTransactionUpdateMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        district_id: 'district-1',
        account_id: 'account-1',
      }),
      'user-1',
      undefined,
    )
  })

  it('auto-posts draft transactions when district auto-post is enabled', async () => {
    const supabase = createPostRouteSupabase([
      {
        id: 'txn-1',
        district_id: 'district-1',
        status: 'draft',
        account_id: 'account-1',
        fund_id: 'fund-1',
        member_id: null,
        counterparty_id: null,
        kind: 'receipt',
        effect_direction: 'in',
        transaction_date: '2026-04-23',
        counterparty: 'Brother A',
        narration: 'Offering',
        currency: 'USD',
        total_amount: 50,
      },
    ])
    createServerClientMock.mockReturnValue(supabase)
    loadDistrictWorkflowSettingsMock.mockResolvedValue({
      id: 'district-1',
      auto_post_cashbook_transactions: true,
    })
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'clerk',
      isSuperuser: false,
    })

    const response = await postTransaction(
      makeRequest() as never,
      { params: Promise.resolve({ id: 'txn-1' }) } as never,
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('posted')
    expect(requireDistrictActionMock).toHaveBeenCalledWith(
      supabase,
      'token-123',
      'district-1',
      'transactions.draft',
    )
    expect(buildPostedTransactionUpdateMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        district_id: 'district-1',
        account_id: 'account-1',
      }),
      'user-1',
      { includeWorkflowActors: true },
    )
  })
})
