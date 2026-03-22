import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const [{ data: districts, error: dErr }, { data: regions, error: rErr }, { data: roleRows, error: prErr }] =
      await Promise.all([
        supabase.from('districts').select('*').order('name'),
        supabase.from('regions').select('*').order('name'),
        supabase.from('person_roles').select('entity_type, entity_id, role, person:people(id, name)'),
      ])

    if (dErr || rErr || prErr) {
      return NextResponse.json({ error: dErr?.message ?? rErr?.message ?? prErr?.message }, { status: 500 })
    }

    // Helper: build a roles map keyed by entity_id
    const rolesForEntity = (entityType: string, entityId: string) =>
      (roleRows ?? [])
        .filter((r) => r.entity_type === entityType && r.entity_id === entityId)
        .map((r) => ({ role: r.role, person: r.person }))

    // Nest regions (with their roles) under their district
    const payload = (districts ?? []).map((d) => ({
      ...d,
      roles: rolesForEntity('district', d.id),
      regions: (regions ?? [])
        .filter((r) => r.district_id === d.id)
        .map((r) => ({ ...r, roles: rolesForEntity('region', r.id) })),
    }))

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
