import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('people')
      .select('id, name, phone, gender, region:regions(id,name), department:departments(id,name)')
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fetch contribution totals from contributions table
    const { data: contributionsData } = await supabase
      .from('contributions')
      .select('person_id, amount')

    const contributionsByPerson = (contributionsData ?? []).reduce(
      (map, c) => {
        map[c.person_id] = (map[c.person_id] ?? 0) + (c.amount ?? 0)
        return map
      },
      {} as Record<string, number>
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      gender: p.gender,
      contribution: contributionsByPerson[p.id] ?? 0,
      region: Array.isArray(p.region) ? (p.region[0] ?? null) : p.region,
      department: Array.isArray(p.department) ? (p.department[0] ?? null) : p.department,
    }))

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
