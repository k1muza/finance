import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/cashbook/transactions/[id]/reverse
// Creates a mirror reversal transaction, posts it, and marks the original as reversed.
// Body: { narration? } — optional note explaining the reversal.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { narration?: string } = {}
  try {
    body = await req.json()
  } catch {
    // narration is optional; ignore parse errors
  }

  const { data: original, error: fetchErr } = await supabase
    .from('cashbook_transactions')
    .select('*, lines:cashbook_transaction_lines(*)')
    .eq('id', id)
    .single()

  if (fetchErr || !original) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (original.status !== 'posted') return NextResponse.json({ error: `Cannot reverse a transaction with status '${original.status}'` }, { status: 422 })

  const now = new Date().toISOString()

  // Generate reference number for the reversal
  const { data: refData, error: refErr } = await supabase
    .rpc('next_transaction_number', { p_district_id: original.district_id })

  if (refErr || !refData) return NextResponse.json({ error: refErr?.message ?? 'Failed to generate reference number' }, { status: 500 })

  // Create the reversal transaction (already posted)
  const { data: reversal, error: reversalErr } = await supabase
    .from('cashbook_transactions')
    .insert({
      district_id: original.district_id,
      account_id: original.account_id,
      fund_id: original.fund_id,
      kind: 'reversal',
      status: 'posted',
      transaction_date: new Date().toISOString().split('T')[0],
      reference_number: refData as string,
      counterparty: original.counterparty,
      narration: body.narration ?? `Reversal of ${original.reference_number ?? original.id}`,
      currency: original.currency,
      total_amount: original.total_amount,
      source_transaction_id: original.id,
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

  if (reversalErr || !reversal) return NextResponse.json({ error: reversalErr?.message ?? 'Failed to create reversal' }, { status: 500 })

  // Mirror the lines with flipped directions
  const lines = (original as { lines?: Array<{
    account_id: string
    fund_id: string | null
    category: string | null
    amount: number
    direction: string
    narration: string | null
  }> }).lines ?? []

  if (lines.length > 0) {
    const reversalLines = lines.map((l) => ({
      transaction_id: reversal.id,
      account_id: l.account_id,
      fund_id: l.fund_id,
      category: l.category,
      amount: l.amount,
      direction: l.direction === 'debit' ? 'credit' : 'debit',
      narration: l.narration,
    }))

    const { error: linesErr } = await supabase.from('cashbook_transaction_lines').insert(reversalLines)
    if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  // Mark the original as reversed (immutability trigger allows posted → reversed)
  const { error: markErr } = await supabase
    .from('cashbook_transactions')
    .update({ status: 'reversed', reversed_by: user.id, reversed_at: now })
    .eq('id', original.id)

  if (markErr) return NextResponse.json({ error: markErr.message }, { status: 500 })

  return NextResponse.json({ data: reversal }, { status: 201 })
}
