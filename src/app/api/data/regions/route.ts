import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: districts, error: dErr } = await supabase.from('districts').select('*').order('name')
    const { data: regions, error: rErr } = await supabase.from('regions').select('*').order('name')

    if (dErr || rErr) {
      return NextResponse.json({ error: dErr?.message ?? rErr?.message }, { status: 500 })
    }

    // Nest regions under their district for convenience
    const payload = (districts ?? []).map((d) => ({
      ...d,
      regions: (regions ?? []).filter((r) => r.district_id === d.id),
    }))

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
