import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/cashbook/transactions/[id]
// Returns transaction with lines and audit log
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const [txnResult, linesResult, auditResult] = await Promise.all([
    supabase
      .from('cashbook_transactions')
      .select('*, account:accounts(id,name,type,currency,status), fund:funds(id,name)')
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

  if (txnResult.error) {
    if (txnResult.error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: txnResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      ...txnResult.data,
      lines: linesResult.data ?? [],
      audit: auditResult.data ?? [],
    },
  })
}
