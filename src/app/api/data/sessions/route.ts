import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const districtId = request.nextUrl.searchParams.get('district_id')

    let query = supabase
      .from('sessions')
      .select('*, day:days!inner(id, date, label)')
      .order('start_time')

    if (districtId) query = query.eq('days.district_id', districtId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (data ?? []).map((s: any) => ({
      id: s.id,
      day_id: s.day_id,
      day: Array.isArray(s.day) ? (s.day[0] ?? null) : s.day,
      name: s.name,
      start_time: s.start_time,
      allocated_duration: s.allocated_duration,
    }))

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
