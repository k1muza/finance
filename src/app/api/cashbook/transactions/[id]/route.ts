import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import {
  hydrateTransactionSources,
  validateDraftTransactionPayload,
} from '@/lib/finance/transaction-server'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'
import type { Currency, TransactionKind } from '@/types'

// GET /api/cashbook/transactions/[id]
// Returns the transaction with lines and audit log.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  try {
    const { data: txnMeta, error: txnMetaError } = await supabase
      .from('cashbook_transactions')
      .select('id, district_id')
      .eq('id', id)
      .maybeSingle()

    if (txnMetaError || !txnMeta) {
      throw new ApiRouteError('TRANSACTION_NOT_FOUND', 'Transaction not found.', 404)
    }

    await requireDistrictAction(supabase, token, txnMeta.district_id, 'transactions.view')

    const [txnResult, linesResult, auditResult] = await Promise.all([
      supabase
        .from('cashbook_transactions')
        .select(
          '*, account:accounts(id,name,type,currency,status), fund:funds(id,name)',
        )
        .eq('id', id)
        .single(),
      supabase
        .from('cashbook_transaction_lines')
        .select('*, account:accounts(id,name,type,currency), fund:funds(id,name)')
        .eq('transaction_id', id)
        .order('created_at'),
      supabase
        .from('cashbook_audit_log')
        .select('*')
        .eq('transaction_id', id)
        .order('created_at'),
    ])

    if (txnResult.error || !txnResult.data) {
      throw new ApiRouteError(
        'TRANSACTION_READ_FAILED',
        txnResult.error?.message ?? 'Failed to load transaction.',
        500,
      )
    }
    if (linesResult.error) {
      throw new ApiRouteError(
        'TRANSACTION_LINES_READ_FAILED',
        linesResult.error.message,
        500,
      )
    }
    if (auditResult.error) {
      throw new ApiRouteError(
        'TRANSACTION_AUDIT_READ_FAILED',
        auditResult.error.message,
        500,
      )
    }

    return NextResponse.json({
      data: {
        ...(await hydrateTransactionSources(supabase, [txnResult.data]))[0],
        lines: linesResult.data ?? [],
        audit: auditResult.data ?? [],
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

// PATCH /api/cashbook/transactions/[id]
// Updates a draft transaction. Only draft transactions may be edited.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  let body: {
    account_id?: string
    fund_id?: string | null
    source_id?: string | null
    kind?: TransactionKind
    effect_direction?: 'in' | 'out' | null
    transaction_date?: string
    counterparty?: string | null
    narration?: string | null
    currency?: Currency
    total_amount?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_JSON' },
      { status: 400 },
    )
  }

  try {
    const { data: txn, error: txnError } = await supabase
      .from('cashbook_transactions')
      .select(
        'id, status, district_id, account_id, fund_id, source_id, kind, effect_direction, transaction_date, counterparty, narration, currency, total_amount',
      )
      .eq('id', id)
      .maybeSingle()

    if (txnError || !txn) {
      throw new ApiRouteError('TRANSACTION_NOT_FOUND', 'Transaction not found.', 404)
    }

    await requireDistrictAction(supabase, token, txn.district_id, 'transactions.draft')

    if (txn.status !== 'draft') {
      throw new ApiRouteError(
        'DRAFT_EDIT_FORBIDDEN',
        'Only draft transactions can be edited.',
        422,
      )
    }

    const validated = await validateDraftTransactionPayload(supabase, {
      district_id: txn.district_id,
      account_id: body.account_id ?? txn.account_id,
      fund_id: body.fund_id !== undefined ? body.fund_id : txn.fund_id,
      source_id: body.source_id !== undefined ? body.source_id : txn.source_id,
      kind: body.kind ?? txn.kind,
      effect_direction: body.effect_direction ?? txn.effect_direction,
      transaction_date: body.transaction_date ?? txn.transaction_date,
      counterparty: body.counterparty !== undefined ? body.counterparty : txn.counterparty,
      narration: body.narration !== undefined ? body.narration : txn.narration,
      currency: body.currency ?? txn.currency,
      total_amount: body.total_amount ?? txn.total_amount,
    }, {
      allowStandaloneTransfer: txn.kind === 'transfer',
    })

    const patch: Record<string, unknown> = {}
    if (validated.values.account_id !== txn.account_id) patch.account_id = validated.values.account_id
    if (validated.values.fund_id !== txn.fund_id) patch.fund_id = validated.values.fund_id
    if (validated.values.source_id !== txn.source_id) patch.source_id = validated.values.source_id
    if (validated.values.kind !== txn.kind) patch.kind = validated.values.kind
    if (validated.values.effect_direction !== txn.effect_direction) patch.effect_direction = validated.values.effect_direction
    if (validated.values.transaction_date !== txn.transaction_date) patch.transaction_date = validated.values.transaction_date
    if (validated.values.counterparty !== txn.counterparty) patch.counterparty = validated.values.counterparty
    if (validated.values.narration !== txn.narration) patch.narration = validated.values.narration
    if (validated.values.currency !== txn.currency) patch.currency = validated.values.currency
    if (validated.values.total_amount !== txn.total_amount) patch.total_amount = validated.values.total_amount

    if (Object.keys(patch).length === 0) {
      throw new ApiRouteError('NO_CHANGES', 'No fields to update.', 400)
    }

    const { data, error } = await supabase
      .from('cashbook_transactions')
      .update(patch)
      .eq('id', id)
      .eq('status', 'draft')
      .select(
        '*, account:accounts(id,name,type,currency,status), fund:funds(id,name)',
      )
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'TRANSACTION_UPDATE_FAILED',
        error?.message ?? 'Failed to update transaction.',
        500,
      )
    }

    const [hydratedData] = await hydrateTransactionSources(supabase, [data])

    return NextResponse.json({ data: hydratedData })
  } catch (error) {
    return toErrorResponse(error)
  }
}
