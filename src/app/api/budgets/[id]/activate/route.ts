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

    await requireDistrictAction(supabase, token, budget.district_id, 'budgets.activate')

    if (!canTransitionBudget(budget.status, 'active')) {
      throw new ApiRouteError(
        'INVALID_BUDGET_STATUS_TRANSITION',
        `Cannot activate a budget with status '${budget.status}'.`,
        422,
      )
    }

    const { count, error: lineCountError } = await supabase
      .from('budget_lines')
      .select('id', { count: 'exact', head: true })
      .eq('budget_id', id)

    if (lineCountError) {
      throw new ApiRouteError('BUDGET_LINE_COUNT_FAILED', lineCountError.message, 500)
    }

    if (!count) {
      throw new ApiRouteError(
        'BUDGET_ACTIVATION_EMPTY',
        'Add at least one budget line before activation.',
        422,
      )
    }

    const { data, error } = await supabase
      .from('budgets')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('status', 'draft')
      .select()
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'BUDGET_ACTIVATE_FAILED',
        error?.message ?? 'Failed to activate budget.',
        500,
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    return toErrorResponse(error)
  }
}
