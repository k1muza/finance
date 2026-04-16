import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { validateDraftTransactionPayload } from '@/lib/finance/transaction-server'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'
import type { Currency, TransactionKind, TransactionStatus } from '@/types'

// GET /api/cashbook/transactions
// Query params: district_id, account_id, status, kind, date_from, date_to, limit, offset
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  try {
    const { searchParams } = req.nextUrl
    const districtId = searchParams.get('district_id')
    const accountId = searchParams.get('account_id')
    const status = searchParams.get('status') as TransactionStatus | null
    const kind = searchParams.get('kind') as TransactionKind | null
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    if (!districtId) {
      throw new ApiRouteError('DISTRICT_ID_REQUIRED', 'district_id is required.', 400)
    }

    await requireDistrictAction(supabase, token, districtId, 'transactions.view')

    let query = supabase
      .from('cashbook_transactions')
      .select(
        '*, account:accounts(id,name,type,currency,status), fund:funds(id,name), source:sources!source_id(id,name,type,title,parent_id,is_active)',
        { count: 'exact' },
      )
      .eq('district_id', districtId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (accountId) query = query.eq('account_id', accountId)
    if (status) query = query.eq('status', status)
    if (kind) query = query.eq('kind', kind)
    if (dateFrom) query = query.gte('transaction_date', dateFrom)
    if (dateTo) query = query.lte('transaction_date', dateTo)

    const { data, error, count } = await query
    if (error) {
      throw new ApiRouteError('TRANSACTION_LIST_FAILED', error.message, 500)
    }

    return NextResponse.json({ data, count })
  } catch (error) {
    return toErrorResponse(error)
  }
}

// POST /api/cashbook/transactions
// Body: { district_id, account_id, fund_id?, source_id?, kind, transaction_date, counterparty?, narration?, currency, total_amount, lines[] }
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  let body: {
    district_id: string
    account_id: string
    fund_id?: string | null
    source_id?: string | null
    kind: TransactionKind
    transaction_date: string
    counterparty?: string | null
    narration?: string | null
    currency: Currency
    total_amount: number
    client_generated_id?: string | null
    device_id?: string | null
    lines?: Array<{
      account_id: string
      fund_id?: string | null
      category?: string | null
      amount: number
      direction: 'debit' | 'credit'
      narration?: string | null
    }>
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
    const actor = await requireDistrictAction(
      supabase,
      token,
      body.district_id,
      'transactions.draft',
    )

    const validated = await validateDraftTransactionPayload(supabase, body)

    if (validated.values.client_generated_id) {
      const { data: existing, error: existingError } = await supabase
        .from('cashbook_transactions')
        .select(
          '*, account:accounts(id,name,type,currency,status), fund:funds(id,name), source:sources!source_id(id,name,type,title,parent_id,is_active)',
        )
        .eq('client_generated_id', validated.values.client_generated_id)
        .maybeSingle()

      if (existingError) {
        throw new ApiRouteError('TRANSACTION_LOOKUP_FAILED', existingError.message, 500)
      }

      if (existing) {
        if (existing.district_id !== validated.values.district_id) {
          throw new ApiRouteError(
            'CLIENT_GENERATED_ID_CONFLICT',
            'client_generated_id already exists for another transaction.',
            409,
          )
        }

        return NextResponse.json({ data: existing, deduplicated: true })
      }
    }

    const { data: txn, error: txnError } = await supabase
      .from('cashbook_transactions')
      .insert({
        ...validated.values,
        status: 'draft',
        created_by: actor.user.id,
      })
      .select(
        '*, account:accounts(id,name,type,currency,status), fund:funds(id,name), source:sources!source_id(id,name,type,title,parent_id,is_active)',
      )
      .single()

    if (txnError || !txn) {
      throw new ApiRouteError(
        'TRANSACTION_CREATE_FAILED',
        txnError?.message ?? 'Failed to create transaction.',
        500,
      )
    }

    if (body.lines && body.lines.length > 0) {
      const lineRows = body.lines.map((line) => ({
        transaction_id: txn.id,
        account_id: line.account_id,
        fund_id: line.fund_id ?? null,
        category: line.category ?? null,
        amount: line.amount,
        direction: line.direction,
        narration: line.narration ?? null,
      }))

      const { error: linesError } = await supabase
        .from('cashbook_transaction_lines')
        .insert(lineRows)

      if (linesError) {
        throw new ApiRouteError(
          'TRANSACTION_LINES_CREATE_FAILED',
          linesError.message,
          500,
        )
      }
    }

    return NextResponse.json({ data: txn }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
