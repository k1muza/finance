import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { canTransitionTransaction } from '@/lib/finance/transactions'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/cashbook/transactions/[id]/reverse
// Creates a mirror reversal transaction, posts it, and marks the original as reversed.
// Body: { narration? } - optional note explaining the reversal.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  let body: { narration?: string } = {}
  try {
    body = await req.json()
  } catch {
    // narration is optional
  }

  try {
    const { data: original, error: originalError } = await supabase
      .from('cashbook_transactions')
      .select('*, lines:cashbook_transaction_lines(*)')
      .eq('id', id)
      .maybeSingle()

    if (originalError || !original) {
      throw new ApiRouteError('TRANSACTION_NOT_FOUND', 'Transaction not found.', 404)
    }

    const actor = await requireDistrictAction(
      supabase,
      token,
      original.district_id,
      'transactions.reverse',
    )

    if (!canTransitionTransaction(original.status, 'reversed')) {
      throw new ApiRouteError(
        'INVALID_STATUS_TRANSITION',
        `Cannot reverse a transaction with status '${original.status}'.`,
        422,
      )
    }
    if (original.kind === 'reversal' || original.source_transaction_id) {
      throw new ApiRouteError(
        'REVERSAL_NOT_ALLOWED',
        'Reversal transactions cannot be reversed again.',
        422,
      )
    }

    const now = new Date().toISOString()

    const { data: refData, error: refError } = await supabase
      .rpc('next_transaction_number', { p_district_id: original.district_id })

    if (refError || !refData) {
      throw new ApiRouteError(
        'REFERENCE_NUMBER_FAILED',
        refError?.message ?? 'Failed to generate reference number.',
        500,
      )
    }

    const { data: reversal, error: reversalError } = await supabase
      .from('cashbook_transactions')
      .insert({
        district_id: original.district_id,
        account_id: original.account_id,
        fund_id: original.fund_id,
        source_id: original.source_id,
        kind: 'reversal',
        status: 'posted',
        transaction_date: new Date().toISOString().split('T')[0],
        reference_number: refData as string,
        counterparty: original.counterparty,
        narration: body.narration?.trim() || `Reversal of ${original.reference_number ?? original.id}`,
        currency: original.currency,
        total_amount: original.total_amount,
        source_transaction_id: original.id,
        assembly_snapshot_id: original.assembly_snapshot_id ?? null,
        region_snapshot_id: original.region_snapshot_id ?? null,
        source_name_snapshot: original.source_name_snapshot ?? null,
        source_type_snapshot: original.source_type_snapshot ?? null,
        source_parent_name_snapshot: original.source_parent_name_snapshot ?? null,
        created_by: actor.user.id,
        submitted_by: actor.user.id,
        approved_by: actor.user.id,
        posted_by: actor.user.id,
        submitted_at: now,
        approved_at: now,
        posted_at: now,
      })
      .select(
        '*, account:accounts(id,name,type,currency,status), fund:funds(id,name), source:sources!source_id(id,name,type,title,parent_id,is_active), assembly_snapshot:sources!assembly_snapshot_id(id,name,type,title), region_snapshot:sources!region_snapshot_id(id,name,type,title)',
      )
      .single()

    if (reversalError || !reversal) {
      throw new ApiRouteError(
        'TRANSACTION_REVERSAL_CREATE_FAILED',
        reversalError?.message ?? 'Failed to create reversal.',
        500,
      )
    }

    const lines = (original as { lines?: Array<{
      account_id: string
      fund_id: string | null
      category: string | null
      amount: number
      direction: string
      narration: string | null
    }> }).lines ?? []

    if (lines.length > 0) {
      const reversalLines = lines.map((line) => ({
        transaction_id: reversal.id,
        account_id: line.account_id,
        fund_id: line.fund_id,
        category: line.category,
        amount: line.amount,
        direction: line.direction === 'debit' ? 'credit' : 'debit',
        narration: line.narration,
      }))

      const { error: linesError } = await supabase
        .from('cashbook_transaction_lines')
        .insert(reversalLines)

      if (linesError) {
        throw new ApiRouteError(
          'TRANSACTION_REVERSAL_LINES_FAILED',
          linesError.message,
          500,
        )
      }
    }

    const { error: markError } = await supabase
      .from('cashbook_transactions')
      .update({ status: 'reversed', reversed_by: actor.user.id, reversed_at: now })
      .eq('id', original.id)
      .eq('status', 'posted')

    if (markError) {
      throw new ApiRouteError(
        'TRANSACTION_REVERSE_FAILED',
        markError.message,
        500,
      )
    }

    return NextResponse.json({ data: reversal }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
