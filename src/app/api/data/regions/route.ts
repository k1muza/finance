import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const [
      { data: districts, error: dErr },
      { data: regions, error: rErr },
      { data: districtRoleRows, error: drErr },
      { data: regionRoleRows, error: rrErr },
    ] = await Promise.all([
      supabase.from('districts').select('*').order('name'),
      supabase.from('regions').select('*').order('name'),
      supabase.from('district_roles').select('district_id, role, person:people(id, name)'),
      supabase.from('region_roles').select('region_id, role, person:people(id, name)'),
    ])

    if (dErr || rErr || drErr || rrErr) {
      return NextResponse.json({ error: dErr?.message ?? rErr?.message ?? drErr?.message ?? rrErr?.message }, { status: 500 })
    }

    // Nest regions (with their roles) under their district
    const payload = (districts ?? []).map((d) => ({
      ...d,
      roles: (districtRoleRows ?? []).filter((r) => r.district_id === d.id).map((r) => ({ role: r.role, person: r.person })),
      regions: (regions ?? [])
        .filter((r) => r.district_id === d.id)
        .map((r) => ({
          ...r,
          roles: (regionRoleRows ?? []).filter((rr) => rr.region_id === r.id).map((rr) => ({ role: rr.role, person: rr.person })),
        })),
    }))

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
