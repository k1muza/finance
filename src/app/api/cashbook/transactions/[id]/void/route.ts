import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { canTransitionTransaction } from '@/lib/finance/transactions'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/cashbook/transactions/[id]/void
// Voids a draft or submitted transaction.
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

    await requireDistrictAction(supabase, token, txn.district_id, 'transactions.draft')

    if (!canTransitionTransaction(txn.status, 'voided')) {
      throw new ApiRouteError(
        'INVALID_STATUS_TRANSITION',
        `Cannot void a transaction with status '${txn.status}'. Only draft or submitted transactions may be voided.`,
        422,
      )
    }

    const { data, error } = await supabase
      .from('cashbook_transactions')
      .update({ status: 'voided' })
      .eq('id', id)
      .eq('status', txn.status)
      .select()
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'TRANSACTION_VOID_FAILED',
        error?.message ?? 'Failed to void transaction.',
        500,
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    return toErrorResponse(error)
  }
}
