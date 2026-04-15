import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/cashbook/transactions/[id]/submit
// Moves status: draft → submitted
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: txn, error: fetchErr } = await supabase
    .from('cashbook_transactions')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchErr || !txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (txn.status !== 'draft') return NextResponse.json({ error: `Cannot submit a transaction with status '${txn.status}'` }, { status: 422 })

  const { data, error } = await supabase
    .from('cashbook_transactions')
    .update({ status: 'submitted', submitted_by: user.id, submitted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
