import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import {
  buildPostingSnapshots,
  validateDraftTransactionPayload,
} from '@/lib/finance/transaction-server'
import { canTransitionTransaction } from '@/lib/finance/transactions'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/cashbook/transactions/[id]/post
// Moves status: approved -> posted
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
        'id, status, district_id, account_id, fund_id, source_id, kind, transaction_date, counterparty, narration, currency, total_amount',
      )
      .eq('id', id)
      .maybeSingle()

    if (txnError || !txn) {
      throw new ApiRouteError('TRANSACTION_NOT_FOUND', 'Transaction not found.', 404)
    }

    const actor = await requireDistrictAction(supabase, token, txn.district_id, 'transactions.post')

    if (!canTransitionTransaction(txn.status, 'posted')) {
      throw new ApiRouteError(
        'INVALID_STATUS_TRANSITION',
        `Cannot post a transaction with status '${txn.status}'.`,
        422,
      )
    }

    await validateDraftTransactionPayload(supabase, {
      district_id: txn.district_id,
      account_id: txn.account_id,
      fund_id: txn.fund_id,
      source_id: txn.source_id,
      kind: txn.kind,
      transaction_date: txn.transaction_date,
      counterparty: txn.counterparty,
      narration: txn.narration,
      currency: txn.currency,
      total_amount: txn.total_amount,
    })

    const snapshots = await buildPostingSnapshots(supabase, txn.district_id, txn.source_id)

    const { data: refData, error: refError } = await supabase
      .rpc('next_transaction_number', { p_district_id: txn.district_id })

    if (refError || !refData) {
      throw new ApiRouteError(
        'REFERENCE_NUMBER_FAILED',
        refError?.message ?? 'Failed to generate reference number.',
        500,
      )
    }

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('cashbook_transactions')
      .update({
        status: 'posted',
        reference_number: refData as string,
        posted_by: actor.user.id,
        posted_at: now,
        source_name_snapshot: snapshots.sourceNameSnapshot,
        source_type_snapshot: snapshots.sourceTypeSnapshot,
        source_parent_name_snapshot: snapshots.sourceParentNameSnapshot,
        assembly_snapshot_id: snapshots.assemblySnapshotId,
        region_snapshot_id: snapshots.regionSnapshotId,
      })
      .eq('id', id)
      .eq('status', 'approved')
      .select(
        '*, account:accounts(id,name,type,currency,status), fund:funds(id,name), source:sources!source_id(id,name,type,title,parent_id,is_active), assembly_snapshot:sources!assembly_snapshot_id(id,name,type,title), region_snapshot:sources!region_snapshot_id(id,name,type,title)',
      )
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'TRANSACTION_POST_FAILED',
        error?.message ?? 'Failed to post transaction.',
        500,
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    return toErrorResponse(error)
  }
}
