import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { TransactionKind, TransactionStatus, Currency } from '@/types'

// GET /api/cashbook/transactions
// Query params: district_id, account_id, status, kind, date_from, date_to, limit, offset
export async function GET(req: NextRequest) {
  const supabase = createServerClient()

  const { searchParams } = req.nextUrl
  const district_id = searchParams.get('district_id')
  const account_id = searchParams.get('account_id')
  const status = searchParams.get('status') as TransactionStatus | null
  const kind = searchParams.get('kind') as TransactionKind | null
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabase
    .from('cashbook_transactions')
    .select('*, account:accounts(id,name,type,currency), fund:funds(id,name)', { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (district_id) query = query.eq('district_id', district_id)
  if (account_id) query = query.eq('account_id', account_id)
  if (status) query = query.eq('status', status)
  if (kind) query = query.eq('kind', kind)
  if (date_from) query = query.gte('transaction_date', date_from)
  if (date_to) query = query.lte('transaction_date', date_to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count })
}

// POST /api/cashbook/transactions
// Body: { district_id, account_id, fund_id?, kind, transaction_date, counterparty?, narration?, currency, total_amount, lines[] }
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    district_id: string
    account_id: string
    fund_id?: string | null
    kind: TransactionKind
    transaction_date: string
    counterparty?: string | null
    narration?: string | null
    currency: Currency
    total_amount: number
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { district_id, account_id, fund_id, kind, transaction_date, counterparty, narration, currency, total_amount, lines } = body

  if (!district_id || !account_id || !kind || !transaction_date || !currency || !total_amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (total_amount <= 0) {
    return NextResponse.json({ error: 'total_amount must be greater than 0' }, { status: 400 })
  }

  // Verify account is active and currency matches
  const { data: account, error: acctErr } = await supabase
    .from('accounts')
    .select('id, district_id, currency, status')
    .eq('id', account_id)
    .single()

  if (acctErr || !account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (account.district_id !== district_id) return NextResponse.json({ error: 'Account does not belong to this district' }, { status: 422 })
  if (account.status !== 'active') return NextResponse.json({ error: 'Account is archived' }, { status: 422 })
  if (account.currency !== currency) return NextResponse.json({ error: `Account currency is ${account.currency}, not ${currency}` }, { status: 422 })

  // Generate reference number — transactions are posted immediately, no approval workflow
  const { data: refData, error: refErr } = await supabase.rpc('next_transaction_number', { p_district_id: district_id })
  if (refErr || !refData) return NextResponse.json({ error: refErr?.message ?? 'Failed to generate reference number' }, { status: 500 })

  const now = new Date().toISOString()

  const { data: txn, error: txnErr } = await supabase
    .from('cashbook_transactions')
    .insert({
      district_id,
      account_id,
      fund_id: fund_id ?? null,
      kind,
      status: 'posted',
      reference_number: refData as string,
      transaction_date,
      counterparty: counterparty ?? null,
      narration: narration ?? null,
      currency,
      total_amount,
      created_by: user.id,
      submitted_by: user.id,
      approved_by: user.id,
      posted_by: user.id,
      submitted_at: now,
      approved_at: now,
      posted_at: now,
    })
    .select()
    .single()

  if (txnErr || !txn) return NextResponse.json({ error: txnErr?.message ?? 'Failed to create transaction' }, { status: 500 })

  if (lines && lines.length > 0) {
    const lineRows = lines.map((l) => ({
      transaction_id: txn.id,
      account_id: l.account_id,
      fund_id: l.fund_id ?? null,
      category: l.category ?? null,
      amount: l.amount,
      direction: l.direction,
      narration: l.narration ?? null,
    }))

    const { error: linesErr } = await supabase.from('cashbook_transaction_lines').insert(lineRows)
    if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  return NextResponse.json({ data: txn }, { status: 201 })
}
