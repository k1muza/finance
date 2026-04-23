import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { canTransitionBudget } from '@/lib/finance/budgets'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  try {
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select('id, district_id, status')
      .eq('id', id)
      .maybeSingle()

    if (budgetError || !budget) {
      throw new ApiRouteError('BUDGET_NOT_FOUND', 'Budget not found.', 404)
    }

    await requireDistrictAction(supabase, token, budget.district_id, 'budgets.close')

    if (!canTransitionBudget(budget.status, 'closed')) {
      throw new ApiRouteError(
        'INVALID_BUDGET_STATUS_TRANSITION',
        `Cannot close a budget with status '${budget.status}'.`,
        422,
      )
    }

    const { data, error } = await supabase
      .from('budgets')
      .update({ status: 'closed' })
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'BUDGET_CLOSE_FAILED',
        error?.message ?? 'Failed to close budget.',
        500,
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    return toErrorResponse(error)
  }
}
