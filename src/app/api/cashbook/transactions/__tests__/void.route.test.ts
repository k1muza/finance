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

import { POST as voidTransaction } from '@/app/api/cashbook/transactions/[id]/void/route'

function matchesFilters(
  row: Record<string, unknown>,
  filters: Array<{ column: string; value: unknown }>,
) {
  return filters.every((filter) => row[filter.column] === filter.value)
}

function createVoidRouteSupabase(transactionRows: Array<Record<string, unknown>>) {
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
  return new Request('http://localhost/api/cashbook/transactions/txn-1/void', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-123',
    },
  })
}

describe('cashbook void route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'clerk',
      isSuperuser: false,
    })
  })

  it('voids submitted transactions', async () => {
    const rows = [
      {
        id: 'txn-1',
        district_id: 'district-1',
        status: 'submitted',
      },
    ]
    const supabase = createVoidRouteSupabase(rows)
    createServerClientMock.mockReturnValue(supabase)

    const response = await voidTransaction(
      makeRequest() as never,
      { params: Promise.resolve({ id: 'txn-1' }) } as never,
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('voided')
    expect(requireDistrictActionMock).toHaveBeenCalledWith(
      supabase,
      'token-123',
      'district-1',
      'transactions.draft',
    )
  })
})
