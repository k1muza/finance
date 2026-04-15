import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  if (process.env.NEXT_PUBLIC_REGISTRATION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Registration is currently disabled.' }, { status: 403 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('districts')
    .select('id, name')
    .order('name')

  if (error) {
    return NextResponse.json({ error: 'Failed to load districts.' }, { status: 500 })
  }

  return NextResponse.json({ districts: data ?? [] })
}
