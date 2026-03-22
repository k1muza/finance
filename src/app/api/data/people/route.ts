import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('people')
      .select('id, name, phone, gender, contribution, region:regions(id,name), department:departments(id,name)')
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      gender: p.gender,
      contribution: p.contribution,
      region: Array.isArray(p.region) ? (p.region[0] ?? null) : p.region,
      department: Array.isArray(p.department) ? (p.department[0] ?? null) : p.department,
    }))

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
