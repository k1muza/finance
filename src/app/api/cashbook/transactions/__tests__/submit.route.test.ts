import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requireDistrictActionMock,
  createServerClientMock,
} = vi.hoisted(() => ({
  requireDistrictActionMock: vi.fn(),
  createServerClientMock: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  requireDistrictAction: requireDistrictActionMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}))

import { POST as submitTransactions } from '@/app/api/cashbook/transactions/submit/route'

function matchesFilters(
  row: Record<string, unknown>,
  filters: Array<{ type: 'eq' | 'in'; column: string; value: unknown }>,
) {
  return filters.every((filter) => {
    if (filter.type === 'eq') {
      return row[filter.column] === filter.value
    }

    return Array.isArray(filter.value) && filter.value.includes(row[filter.column])
  })
}

function createSubmitRouteSupabase(transactionRows: Array<Record<string, unknown>>) {
  return {
    from(tableName: string) {
      const filters: Array<{ type: 'eq' | 'in'; column: string; value: unknown }> = []
      let updatePayload: Record<string, unknown> | null = null

      const builder = {
        select(_columns?: string) {
          return builder
        },

        eq(column: string, value: unknown) {
          filters.push({ type: 'eq', column, value })
          return builder
        },

        in(column: string, value: unknown[]) {
          filters.push({ type: 'in', column, value })
          return builder
        },

        update(payload: Record<string, unknown>) {
          updatePayload = payload
          return builder
        },

        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          if (tableName !== 'cashbook_transactions') {
            return Promise.resolve({
              data: null,
              error: { message: `Unsupported table ${tableName}` },
            }).then(onFulfilled, onRejected)
          }

          const rows = transactionRows.filter((row) => matchesFilters(row, filters))

          if (updatePayload) {
            rows.forEach((row) => Object.assign(row, updatePayload))
          }

          return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
        },
      }

      return builder
    },
  }
}

function makeRequest(ids: string[]) {
  return new Request('http://localhost/api/cashbook/transactions/submit', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-123',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  })
}

describe('cashbook bulk submit route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'clerk',
      isSuperuser: false,
    })
  })

  it('submits multiple draft transactions together', async () => {
    const rows = [
      { id: 'txn-1', district_id: 'district-1', status: 'draft' },
      { id: 'txn-2', district_id: 'district-1', status: 'draft' },
    ]
    const supabase = createSubmitRouteSupabase(rows)
    createServerClientMock.mockReturnValue(supabase)

    const response = await submitTransactions(makeRequest(['txn-1', 'txn-2']) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.count).toBe(2)
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'txn-1',
        status: 'submitted',
        submitted_by: 'user-1',
      }),
      expect.objectContaining({
        id: 'txn-2',
        status: 'submitted',
        submitted_by: 'user-1',
      }),
    ])
    expect(requireDistrictActionMock).toHaveBeenCalledWith(
      supabase,
      'token-123',
      'district-1',
      'transactions.draft',
    )
  })

  it('rejects non-draft transactions in the batch', async () => {
    const supabase = createSubmitRouteSupabase([
      { id: 'txn-1', district_id: 'district-1', status: 'draft' },
      { id: 'txn-2', district_id: 'district-1', status: 'approved' },
    ])
    createServerClientMock.mockReturnValue(supabase)

    const response = await submitTransactions(makeRequest(['txn-1', 'txn-2']) as never)
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.code).toBe('INVALID_STATUS_TRANSITION')
    expect(body.error).toBe('Only draft transactions can be submitted in bulk.')
  })
})
