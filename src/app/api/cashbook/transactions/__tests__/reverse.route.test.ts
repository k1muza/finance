import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireDistrictActionMock,
  createServerClientMock,
  hydrateTransactionPartiesMock,
} = vi.hoisted(() => ({
  requireDistrictActionMock: vi.fn(),
  createServerClientMock: vi.fn(),
  hydrateTransactionPartiesMock: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  requireDistrictAction: requireDistrictActionMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('@/lib/finance/transaction-server', () => ({
  hydrateTransactionParties: hydrateTransactionPartiesMock,
}))

import { POST as reverseTransaction } from '@/app/api/cashbook/transactions/[id]/reverse/route'

function matchesFilters(
  row: Record<string, unknown>,
  filters: Array<{ column: string; value: unknown }>,
) {
  return filters.every((filter) => row[filter.column] === filter.value)
}

function createReverseRouteSupabase(transactionRows: Array<Record<string, unknown>>) {
  const lineRows: Array<Record<string, unknown>> = []
  let transactionNumber = 1

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
          if (tableName !== 'cashbook_transactions') {
            return { data: null, error: { message: `Unsupported table ${tableName}` } }
          }

          const rows = transactionRows.filter((row) => matchesFilters(row, filters))
          return { data: rows[0] ?? null, error: null }
        },

        async single() {
          if (tableName === 'cashbook_transactions' && insertPayload && !Array.isArray(insertPayload)) {
            const row = {
              id: `txn-${transactionRows.length + 1}`,
              ...insertPayload,
            }
            transactionRows.push(row)
            return { data: row, error: null }
          }

          if (tableName === 'cashbook_transactions' && updatePayload) {
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

          return { data: null, error: { message: `single() not supported for ${tableName}` } }
        },

        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          if (tableName === 'cashbook_transactions' && updatePayload) {
            const rows = transactionRows.filter((row) => matchesFilters(row, filters))

            if (rows.length === 1) {
              Object.assign(rows[0], updatePayload)
              return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)
            }

            return Promise.resolve({
              data: null,
              error: { message: rows.length === 0 ? 'No rows returned' : 'Multiple rows returned' },
            }).then(onFulfilled, onRejected)
          }

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

    async rpc(name: string) {
      if (name !== 'next_transaction_number') {
        return { data: null, error: { message: `Unsupported rpc ${name}` } }
      }

      const value = `TXN-2026-${String(transactionNumber).padStart(4, '0')}`
      transactionNumber += 1
      return { data: value, error: null }
    },
  }
}

function makeRequest(body?: Record<string, unknown>) {
  return new Request('http://localhost/api/cashbook/transactions/txn-1/reverse', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-123',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('cashbook reverse route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hydrateTransactionPartiesMock.mockImplementation(async (_supabase, rows) => rows)
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'accounting_officer',
      isSuperuser: false,
    })
  })

  it('creates a posted reversal and marks the original as reversed', async () => {
    const rows = [
      {
        id: 'txn-1',
        district_id: 'district-1',
        account_id: 'account-1',
        fund_id: 'fund-1',
        member_id: null,
        counterparty_id: null,
        transfer_id: null,
        kind: 'receipt',
        effect_direction: 'in',
        status: 'posted',
        transaction_date: '2026-04-23',
        reference_number: 'TXN-2026-0007',
        counterparty: 'Brother A',
        narration: 'Offering',
        currency: 'USD',
        total_amount: 50,
        source_transaction_id: null,
        lines: [
          {
            account_id: 'account-1',
            fund_id: 'fund-1',
            category: 'offering',
            amount: 50,
            direction: 'credit',
            narration: 'Line 1',
          },
        ],
      },
    ]

    const supabase = createReverseRouteSupabase(rows)
    createServerClientMock.mockReturnValue(supabase)

    const response = await reverseTransaction(
      makeRequest({ narration: 'Incorrect amount' }) as never,
      { params: Promise.resolve({ id: 'txn-1' }) } as never,
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.kind).toBe('reversal')
    expect(body.data.status).toBe('posted')
    expect(body.data.effect_direction).toBe('out')
    expect(body.data.source_transaction_id).toBe('txn-1')
    expect(body.data.narration).toBe('Incorrect amount')
    expect(supabase.__tables.transactionRows[0]).toMatchObject({
      status: 'reversed',
      reversed_by: 'user-1',
    })
    expect(supabase.__tables.lineRows).toHaveLength(1)
    expect(supabase.__tables.lineRows[0]).toMatchObject({
      transaction_id: body.data.id,
      direction: 'debit',
      amount: 50,
    })
  })

  it('returns 404 when the original transaction does not exist', async () => {
    const supabase = createReverseRouteSupabase([])
    createServerClientMock.mockReturnValue(supabase)

    const response = await reverseTransaction(
      makeRequest() as never,
      { params: Promise.resolve({ id: 'missing-txn' }) } as never,
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe('TRANSACTION_NOT_FOUND')
  })
})
