import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('meals')
      .select('*, day:days(id, date, label), menu_items:meal_menu_items(id, name, notes, sort_order)')
      .order('scheduled_time')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (data ?? []).map((m: any) => ({
      id: m.id,
      day_id: m.day_id,
      day: Array.isArray(m.day) ? (m.day[0] ?? null) : m.day,
      name: m.name,
      scheduled_time: m.scheduled_time,
      duration: m.duration,
      menu_items: (m.menu_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    }))

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
