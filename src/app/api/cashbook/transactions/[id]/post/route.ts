import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/cashbook/transactions/[id]/post
// Moves status: approved → posted
// Assigns a district-scoped reference number via next_transaction_number().
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: txn, error: fetchErr } = await supabase
    .from('cashbook_transactions')
    .select('id, status, district_id, account_id')
    .eq('id', id)
    .single()

  if (fetchErr || !txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (txn.status !== 'approved') return NextResponse.json({ error: `Cannot post a transaction with status '${txn.status}'` }, { status: 422 })

  // Verify the account is still active
  const { data: account, error: acctErr } = await supabase
    .from('accounts')
    .select('status')
    .eq('id', txn.account_id)
    .single()

  if (acctErr || !account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (account.status !== 'active') return NextResponse.json({ error: 'Cannot post to an archived account' }, { status: 422 })

  // Generate the reference number atomically
  const { data: refData, error: refErr } = await supabase
    .rpc('next_transaction_number', { p_district_id: txn.district_id })

  if (refErr || !refData) return NextResponse.json({ error: refErr?.message ?? 'Failed to generate reference number' }, { status: 500 })

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('cashbook_transactions')
    .update({
      status: 'posted',
      reference_number: refData as string,
      posted_by: user.id,
      posted_at: now,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
