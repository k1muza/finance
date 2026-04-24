import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import {
  buildPostedTransactionUpdate,
  hydrateTransactionParties,
  loadDistrictWorkflowSettings,
} from '@/lib/finance/transaction-server'
import { canTransitionTransaction } from '@/lib/finance/transactions'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/cashbook/transactions/[id]/post
// Moves status: approved -> posted
// When district auto-post is enabled, drafts may also be posted directly.
// Assigns a district-scoped reference number via next_transaction_number().
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
      .select(
        'id, status, district_id, account_id, fund_id, member_id, counterparty_id, kind, effect_direction, transaction_date, counterparty, narration, currency, total_amount',
      )
      .eq('id', id)
      .maybeSingle()

    if (txnError || !txn) {
      throw new ApiRouteError('TRANSACTION_NOT_FOUND', 'Transaction not found.', 404)
    }

    const districtSettings = await loadDistrictWorkflowSettings(supabase, txn.district_id)
    const canAutoPost = ['draft', 'submitted'].includes(txn.status) && districtSettings.auto_post_cashbook_transactions
    const canPostApproved = canTransitionTransaction(txn.status, 'posted')

    if (!canPostApproved && !canAutoPost) {
      throw new ApiRouteError(
        'INVALID_STATUS_TRANSITION',
        `Cannot post a transaction with status '${txn.status}'.`,
        422,
      )
    }

    const actor = await requireDistrictAction(
      supabase,
      token,
      txn.district_id,
      canAutoPost ? 'transactions.draft' : 'transactions.post',
    )

    const postedValues = await buildPostedTransactionUpdate(
      supabase,
      {
        district_id: txn.district_id,
        account_id: txn.account_id,
        fund_id: txn.fund_id,
        member_id: txn.member_id,
        counterparty_id: txn.counterparty_id,
        kind: txn.kind,
        effect_direction: txn.effect_direction,
        transaction_date: txn.transaction_date,
        counterparty: txn.counterparty,
        narration: txn.narration,
        currency: txn.currency,
        total_amount: txn.total_amount,
      },
      actor.user.id,
      canAutoPost ? { includeWorkflowActors: true } : undefined,
    )

    const { data, error } = await supabase
      .from('cashbook_transactions')
      .update(postedValues)
      .eq('id', id)
      .eq('status', canAutoPost ? txn.status : 'approved')
      .select(
        '*, account:accounts(id,name,type,currency,status), fund:funds(id,name)',
      )
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'TRANSACTION_POST_FAILED',
        error?.message ?? 'Failed to post transaction.',
        500,
      )
    }

    const [hydratedData] = await hydrateTransactionParties(supabase, [data])

    return NextResponse.json({ data: hydratedData })
  } catch (error) {
    return toErrorResponse(error)
  }
}
