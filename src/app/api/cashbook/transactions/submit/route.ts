import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { canTransitionTransaction } from '@/lib/finance/transactions'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

interface SubmitTransactionsBody {
  ids?: string[]
}

// POST /api/cashbook/transactions/submit
// Body: { ids: string[] }
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  let body: SubmitTransactionsBody

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_JSON' },
      { status: 400 },
    )
  }

  try {
    const uniqueIds = Array.from(new Set((body.ids ?? []).filter(Boolean)))

    if (uniqueIds.length === 0) {
      throw new ApiRouteError(
        'TRANSACTION_IDS_REQUIRED',
        'Select at least one transaction to submit.',
        400,
      )
    }

    if (uniqueIds.length > 200) {
      throw new ApiRouteError(
        'TOO_MANY_TRANSACTIONS',
        'You can only submit up to 200 transactions at a time.',
        422,
      )
    }

    const { data: transactions, error: transactionError } = await supabase
      .from('cashbook_transactions')
      .select('id, status, district_id')
      .in('id', uniqueIds)

    if (transactionError) {
      throw new ApiRouteError(
        'TRANSACTION_LOOKUP_FAILED',
        transactionError.message,
        500,
      )
    }

    if (!transactions || transactions.length !== uniqueIds.length) {
      throw new ApiRouteError(
        'TRANSACTION_NOT_FOUND',
        'One or more selected transactions could not be found.',
        404,
      )
    }

    const districtIds = Array.from(new Set(transactions.map((transaction) => transaction.district_id)))
    if (districtIds.length !== 1) {
      throw new ApiRouteError(
        'MIXED_DISTRICT_TRANSACTIONS',
        'Selected transactions must belong to the same district.',
        422,
      )
    }

    const invalidTransactions = transactions.filter((transaction) =>
      !canTransitionTransaction(transaction.status, 'submitted'),
    )

    if (invalidTransactions.length > 0) {
      throw new ApiRouteError(
        'INVALID_STATUS_TRANSITION',
        'Only draft transactions can be submitted in bulk.',
        422,
      )
    }

    const actor = await requireDistrictAction(
      supabase,
      token,
      districtIds[0],
      'transactions.draft',
    )

    const submittedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('cashbook_transactions')
      .update({
        status: 'submitted',
        submitted_by: actor.user.id,
        submitted_at: submittedAt,
      })
      .in('id', uniqueIds)
      .eq('status', 'draft')
      .select('id, status, submitted_by, submitted_at')

    if (error) {
      throw new ApiRouteError(
        'TRANSACTION_SUBMIT_FAILED',
        error.message,
        500,
      )
    }

    if (!data || data.length !== uniqueIds.length) {
      throw new ApiRouteError(
        'TRANSACTION_SUBMIT_CONFLICT',
        'One or more selected transactions are no longer draft.',
        409,
      )
    }

    return NextResponse.json({
      count: data.length,
      data,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
