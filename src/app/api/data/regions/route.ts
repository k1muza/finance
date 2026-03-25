import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const districtId = request.nextUrl.searchParams.get('district_id')

    let districtsQuery = supabase.from('districts').select('*').order('name')
    let regionsQuery = supabase.from('regions').select('*').order('name')
    let districtRolesQuery = supabase.from('district_roles').select('district_id, role, person:people(id, name)')

    if (districtId) {
      districtsQuery = districtsQuery.eq('id', districtId)
      regionsQuery = regionsQuery.eq('district_id', districtId)
      districtRolesQuery = districtRolesQuery.eq('district_id', districtId)
    }

    const [
      { data: districts, error: dErr },
      { data: regions, error: rErr },
      { data: districtRoleRows, error: drErr },
    ] = await Promise.all([districtsQuery, regionsQuery, districtRolesQuery])

    if (dErr || rErr || drErr) {
      return NextResponse.json({ error: dErr?.message ?? rErr?.message ?? drErr?.message }, { status: 500 })
    }

    const regionIds = (regions ?? []).map((r) => r.id)
    const { data: regionRoleRows, error: rrErr } = await supabase
      .from('region_roles')
      .select('region_id, role, person:people(id, name)')
      .in('region_id', regionIds.length > 0 ? regionIds : [''])

    if (rrErr) return NextResponse.json({ error: rrErr.message }, { status: 500 })

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
