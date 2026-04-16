import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { canTransitionTransaction } from '@/lib/finance/transactions'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/cashbook/transactions/[id]/submit
// Moves status: draft -> submitted
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
      .select('id, status, district_id')
      .eq('id', id)
      .maybeSingle()

    if (txnError || !txn) {
      throw new ApiRouteError('TRANSACTION_NOT_FOUND', 'Transaction not found.', 404)
    }

    const actor = await requireDistrictAction(supabase, token, txn.district_id, 'transactions.draft')

    if (!canTransitionTransaction(txn.status, 'submitted')) {
      throw new ApiRouteError(
        'INVALID_STATUS_TRANSITION',
        `Cannot submit a transaction with status '${txn.status}'.`,
        422,
      )
    }

    const { data, error } = await supabase
      .from('cashbook_transactions')
      .update({
        status: 'submitted',
        submitted_by: actor.user.id,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'draft')
      .select()
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'TRANSACTION_SUBMIT_FAILED',
        error?.message ?? 'Failed to submit transaction.',
        500,
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    return toErrorResponse(error)
  }
}
