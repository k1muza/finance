import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { canTransitionTransaction } from '@/lib/finance/transactions'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/cashbook/transactions/[id]/approve
// Moves status: submitted -> approved
// The approver cannot be the same user who created the transaction.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  try {
    const { data: txn, error: txnError } = await supabase
      .from('cashbook_transactions')
      .select('id, status, created_by, district_id')
      .eq('id', id)
      .maybeSingle()

    if (txnError || !txn) {
      throw new ApiRouteError('TRANSACTION_NOT_FOUND', 'Transaction not found.', 404)
    }

    const actor = await requireDistrictAction(
      supabase,
      token,
      txn.district_id,
      'transactions.approve',
    )

    if (!canTransitionTransaction(txn.status, 'approved')) {
      throw new ApiRouteError(
        'INVALID_STATUS_TRANSITION',
        `Cannot approve a transaction with status '${txn.status}'.`,
        422,
      )
    }
    if (txn.created_by === actor.user.id) {
      throw new ApiRouteError(
        'APPROVAL_SELF_FORBIDDEN',
        'A preparer cannot approve their own transaction.',
        422,
      )
    }

    const { data, error } = await supabase
      .from('cashbook_transactions')
      .update({
        status: 'approved',
        approved_by: actor.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'submitted')
      .select()
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'TRANSACTION_APPROVE_FAILED',
        error?.message ?? 'Failed to approve transaction.',
        500,
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    return toErrorResponse(error)
  }
}
