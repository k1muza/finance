import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireDistrictActionMock,
  createServerClientMock,
  validateDraftTransactionPayloadMock,
  loadDistrictWorkflowSettingsMock,
  buildPostedTransactionUpdateMock,
  hydrateTransactionPartiesMock,
} = vi.hoisted(() => ({
  requireDistrictActionMock: vi.fn(),
  createServerClientMock: vi.fn(),
  validateDraftTransactionPayloadMock: vi.fn(),
  loadDistrictWorkflowSettingsMock: vi.fn(),
  buildPostedTransactionUpdateMock: vi.fn(),
  hydrateTransactionPartiesMock: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  requireDistrictAction: requireDistrictActionMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('@/lib/finance/transaction-server', () => ({
  validateDraftTransactionPayload: validateDraftTransactionPayloadMock,
  loadDistrictWorkflowSettings: loadDistrictWorkflowSettingsMock,
  buildPostedTransactionUpdate: buildPostedTransactionUpdateMock,
  hydrateTransactionParties: hydrateTransactionPartiesMock,
}))

import { POST as createTransaction } from '@/app/api/cashbook/transactions/route'

function matchesFilters(
  row: Record<string, unknown>,
  filters: Array<{ column: string; value: unknown }>,
) {
  return filters.every((filter) => row[filter.column] === filter.value)
}

function createCashbookRouteSupabase() {
  const transactionRows: Array<Record<string, unknown>> = []
  const lineRows: Array<Record<string, unknown>> = []

  return {
    __tables: {
      transactionRows,
      lineRows,
    },

    from(tableName: string) {
      const filters: Array<{ column: string; value: unknown }> = []
      let insertPayload: Record<string, unknown> | Record<string, unknown>[] | null = null
      let updatePayload: Record<string, unknown> | null = null

      const builder = {
        select() {
          return builder
        },

        eq(column: string, value: unknown) {
          filters.push({ column, value })
          return builder
        },

        insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
          insertPayload = payload
          return builder
        },

        update(payload: Record<string, unknown>) {
          updatePayload = payload
          return builder
        },

        async maybeSingle() {
          const rows = transactionRows.filter((row) => matchesFilters(row, filters))
          return { data: rows[0] ?? null, error: null }
        },

        async single() {
          if (tableName !== 'cashbook_transactions') {
            return {
              data: null,
              error: { message: `single() not supported for ${tableName}` },
            }
          }

          if (insertPayload && !Array.isArray(insertPayload)) {
            const row = {
              id: `txn-${transactionRows.length + 1}`,
              ...insertPayload,
            }
            transactionRows.push(row)
            return { data: row, error: null }
          }

          if (updatePayload) {
            const rows = transactionRows.filter((row) => matchesFilters(row, filters))
            if (rows.length !== 1) {
              return {
                data: null,
                error: { message: rows.length === 0 ? 'No rows returned' : 'Multiple rows returned' },
              }
            }

            Object.assign(rows[0], updatePayload)
            return { data: rows[0], error: null }
          }

          const rows = transactionRows.filter((row) => matchesFilters(row, filters))
          return {
            data: rows[0] ?? null,
            error: rows.length === 1 ? null : { message: 'No rows returned' },
          }
        },

        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          if (tableName === 'cashbook_transaction_lines' && insertPayload) {
            const rows = (Array.isArray(insertPayload) ? insertPayload : [insertPayload]).map((row, index) => ({
              id: `line-${lineRows.length + index + 1}`,
              ...row,
            }))
            lineRows.push(...rows)

            return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
          }

          return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)
        },
      }

      return builder
    },
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/cashbook/transactions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-123',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('cashbook transaction create route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hydrateTransactionPartiesMock.mockImplementation(async (_supabase, rows) => rows)
    validateDraftTransactionPayloadMock.mockResolvedValue({
      values: {
        district_id: 'district-1',
        account_id: 'account-1',
        fund_id: 'fund-1',
        member_id: null,
        counterparty_id: null,
        kind: 'receipt',
        effect_direction: 'in',
        transaction_date: '2026-04-23',
        counterparty: 'Brother A',
        narration: 'Sunday service',
        currency: 'USD',
        total_amount: 125,
        client_generated_id: null,
        device_id: null,
      },
    })
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'clerk',
      isSuperuser: false,
    })
  })

  it('creates a draft transaction when auto-post is disabled', async () => {
    const supabase = createCashbookRouteSupabase()
    createServerClientMock.mockReturnValue(supabase)
    loadDistrictWorkflowSettingsMock.mockResolvedValue({
      id: 'district-1',
      auto_post_cashbook_transactions: false,
    })

    const response = await createTransaction(makeRequest({
      district_id: 'district-1',
      account_id: 'account-1',
      kind: 'receipt',
      transaction_date: '2026-04-23',
      currency: 'USD',
      total_amount: 125,
      lines: [
        {
          account_id: 'account-1',
          amount: 125,
          direction: 'credit',
        },
      ],
    }) as never)

    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.status).toBe('draft')
    expect(supabase.__tables.transactionRows[0].status).toBe('draft')
    expect(supabase.__tables.lineRows).toHaveLength(1)
    expect(buildPostedTransactionUpdateMock).not.toHaveBeenCalled()
    expect(requireDistrictActionMock).toHaveBeenCalledWith(
      supabase,
      'token-123',
      'district-1',
      'transactions.draft',
    )
  })

  it('auto-posts new transactions when the district flag is enabled', async () => {
    const supabase = createCashbookRouteSupabase()
    createServerClientMock.mockReturnValue(supabase)
    loadDistrictWorkflowSettingsMock.mockResolvedValue({
      id: 'district-1',
      auto_post_cashbook_transactions: true,
    })
    buildPostedTransactionUpdateMock.mockResolvedValue({
      status: 'posted',
      reference_number: 'TXN-2026-0001',
      submitted_by: 'user-1',
      submitted_at: '2026-04-23T10:00:00.000Z',
      approved_by: 'user-1',
      approved_at: '2026-04-23T10:00:00.000Z',
      posted_by: 'user-1',
      posted_at: '2026-04-23T10:00:00.000Z',
    })

    const response = await createTransaction(makeRequest({
      district_id: 'district-1',
      account_id: 'account-1',
      kind: 'receipt',
      transaction_date: '2026-04-23',
      currency: 'USD',
      total_amount: 125,
    }) as never)

    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.status).toBe('posted')
    expect(body.data.reference_number).toBe('TXN-2026-0001')
    expect(supabase.__tables.transactionRows[0]).toMatchObject({
      status: 'posted',
      reference_number: 'TXN-2026-0001',
      submitted_by: 'user-1',
      approved_by: 'user-1',
      posted_by: 'user-1',
    })
    expect(buildPostedTransactionUpdateMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        district_id: 'district-1',
        account_id: 'account-1',
        kind: 'receipt',
      }),
      'user-1',
      { includeWorkflowActors: true },
    )
  })
})
