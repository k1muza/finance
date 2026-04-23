import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRouteError } from '@/lib/server/errors'

const { requireDistrictActionMock, createServerClientMock } = vi.hoisted(() => ({
  requireDistrictActionMock: vi.fn(),
  createServerClientMock: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  requireDistrictAction: requireDistrictActionMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}))

import { POST as activateBudget } from '@/app/api/budgets/[id]/activate/route'
import { POST as closeBudget } from '@/app/api/budgets/[id]/close/route'

interface BudgetRow {
  id: string
  district_id: string
  status: 'draft' | 'active' | 'closed'
}

interface BudgetLineRow {
  id: string
  budget_id: string
}

function matchesFilters(
  row: Record<string, unknown>,
  filters: Array<{ column: string; value: unknown }>,
) {
  return filters.every((filter) => row[filter.column] === filter.value)
}

function createBudgetRouteSupabase({
  budgets,
  budgetLines,
}: {
  budgets: BudgetRow[]
  budgetLines: BudgetLineRow[]
}) {
  const budgetRows = budgets.map((budget) => ({ ...budget }))
  const budgetLineRows = budgetLines.map((line) => ({ ...line }))

  return {
    __tables: {
      budgetRows,
      budgetLineRows,
    },

    from(tableName: string) {
      const filters: Array<{ column: string; value: unknown }> = []
      let updatePayload: Record<string, unknown> | null = null
      let selectOptions: { count?: string; head?: boolean } | undefined

      const getTable = () => {
        if (tableName === 'budgets') return budgetRows as Record<string, unknown>[]
        if (tableName === 'budget_lines') return budgetLineRows as Record<string, unknown>[]
        return []
      }

      const filteredRows = () => getTable().filter((row) => matchesFilters(row, filters))

      const builder = {
        select(_columns: string, options?: { count?: string; head?: boolean }) {
          selectOptions = options
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
          const rows = filteredRows()
          return { data: rows[0] ?? null, error: null }
        },

        async single() {
          const rows = filteredRows()

          if (rows.length !== 1) {
            return {
              data: null,
              error: {
                message: rows.length === 0 ? 'No rows returned' : 'Multiple rows returned',
              },
            }
          }

          if (updatePayload) {
            Object.assign(rows[0], updatePayload)
          }

          return { data: rows[0], error: null }
        },

        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          const rows = filteredRows()
          const result = selectOptions?.head
            ? { data: null, error: null, count: rows.length }
            : { data: rows, error: null, count: null }

          return Promise.resolve(result).then(onFulfilled, onRejected)
        },
      }

      return builder
    },
  }
}

function makeRequest() {
  return new Request('http://localhost/api/budgets/budget-1/action', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-123',
    },
  })
}

describe('budget lifecycle routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('activates a draft budget that already has lines', async () => {
    const supabase = createBudgetRouteSupabase({
      budgets: [
        { id: 'budget-1', district_id: 'district-1', status: 'draft' },
      ],
      budgetLines: [
        { id: 'line-1', budget_id: 'budget-1' },
      ],
    })

    createServerClientMock.mockReturnValue(supabase)
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'treasurer',
      isSuperuser: false,
    })

    const response = await activateBudget(makeRequest() as never, {
      params: Promise.resolve({ id: 'budget-1' }),
    })

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('active')
    expect(supabase.__tables.budgetRows[0].status).toBe('active')
    expect(requireDistrictActionMock).toHaveBeenCalledWith(
      supabase,
      'token-123',
      'district-1',
      'budgets.activate',
    )
  })

  it('rejects activation when the draft budget has no lines', async () => {
    const supabase = createBudgetRouteSupabase({
      budgets: [
        { id: 'budget-1', district_id: 'district-1', status: 'draft' },
      ],
      budgetLines: [],
    })

    createServerClientMock.mockReturnValue(supabase)
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'treasurer',
      isSuperuser: false,
    })

    const response = await activateBudget(makeRequest() as never, {
      params: Promise.resolve({ id: 'budget-1' }),
    })

    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.code).toBe('BUDGET_ACTIVATION_EMPTY')
    expect(supabase.__tables.budgetRows[0].status).toBe('draft')
  })

  it('rejects close when the budget is not active', async () => {
    const supabase = createBudgetRouteSupabase({
      budgets: [
        { id: 'budget-1', district_id: 'district-1', status: 'draft' },
      ],
      budgetLines: [
        { id: 'line-1', budget_id: 'budget-1' },
      ],
    })

    createServerClientMock.mockReturnValue(supabase)
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'treasurer',
      isSuperuser: false,
    })

    const response = await closeBudget(makeRequest() as never, {
      params: Promise.resolve({ id: 'budget-1' }),
    })

    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.code).toBe('INVALID_BUDGET_STATUS_TRANSITION')
    expect(supabase.__tables.budgetRows[0].status).toBe('draft')
  })

  it('closes an active budget', async () => {
    const supabase = createBudgetRouteSupabase({
      budgets: [
        { id: 'budget-1', district_id: 'district-1', status: 'active' },
      ],
      budgetLines: [
        { id: 'line-1', budget_id: 'budget-1' },
      ],
    })

    createServerClientMock.mockReturnValue(supabase)
    requireDistrictActionMock.mockResolvedValue({
      user: { id: 'user-1' },
      role: 'treasurer',
      isSuperuser: false,
    })

    const response = await closeBudget(makeRequest() as never, {
      params: Promise.resolve({ id: 'budget-1' }),
    })

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('closed')
    expect(supabase.__tables.budgetRows[0].status).toBe('closed')
    expect(requireDistrictActionMock).toHaveBeenCalledWith(
      supabase,
      'token-123',
      'district-1',
      'budgets.close',
    )
  })

  it('returns permission errors from the district action guard', async () => {
    const supabase = createBudgetRouteSupabase({
      budgets: [
        { id: 'budget-1', district_id: 'district-1', status: 'draft' },
      ],
      budgetLines: [
        { id: 'line-1', budget_id: 'budget-1' },
      ],
    })

    createServerClientMock.mockReturnValue(supabase)
    requireDistrictActionMock.mockRejectedValue(
      new ApiRouteError(
        'ACTION_FORBIDDEN',
        'You do not have permission to perform this action in the selected district.',
        403,
      ),
    )

    const response = await activateBudget(makeRequest() as never, {
      params: Promise.resolve({ id: 'budget-1' }),
    })

    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.code).toBe('ACTION_FORBIDDEN')
    expect(supabase.__tables.budgetRows[0].status).toBe('draft')
  })
})
