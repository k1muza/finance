import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: depts, error } = await supabase.from('departments').select('*').order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: people } = await supabase
      .from('people')
      .select('id, name, department_id')
      .not('department_id', 'is', null)

    const memberMap: Record<string, { id: string; name: string }[]> = {}
    people?.forEach((p) => {
      if (p.department_id) {
        memberMap[p.department_id] = [...(memberMap[p.department_id] ?? []), { id: p.id, name: p.name }]
      }
    })

    const { data: hodRoles } = await supabase
      .from('department_roles')
      .select('department_id, person:people(id, name)')
      .eq('role', 'hod')

    const hodMap: Record<string, { id: string; name: string }> = {}
    hodRoles?.forEach((r) => {
      if (r.department_id && r.person) hodMap[r.department_id] = r.person as unknown as { id: string; name: string }
    })

    const payload = (depts ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      hod: hodMap[d.id] ?? null,
      members: memberMap[d.id] ?? [],
    }))

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
