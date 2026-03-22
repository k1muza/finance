import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { parseCsv } from '@/lib/csv'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) return NextResponse.json({ imported: 0, updated: 0, errors: [] })

    const supabase = createServerClient()

    // Build department name → id lookup (case-insensitive)
    const { data: departments } = await supabase.from('departments').select('id, name')
    const deptByName: Record<string, string> = {}
    for (const d of departments ?? []) {
      deptByName[d.name.toLowerCase()] = d.id
    }

    let imported = 0, updated = 0
    const errors: string[] = []

    for (const row of rows) {
      const name = row['name']
      if (!name) { errors.push(`Skipped row: missing name`); continue }

      const isUpdate = !!row['id']

      // Resolve department by name
      let department_id: string | null = null
      const deptName = row['department']?.trim()
      if (deptName) {
        department_id = deptByName[deptName.toLowerCase()] ?? null
        if (!department_id) {
          errors.push(`${name}: department "${deptName}" not found — skipping department assignment`)
        }
      }

      const personRecord = {
        ...(isUpdate ? { id: row['id'] } : {}),
        name,
        phone:         row['phone']         || null,
        gender:        (['male', 'female', 'other'].includes(row['gender']) ? row['gender'] : null) as 'male' | 'female' | 'other' | null,
        region_id:     row['region_id']     || null,
        department_id,
      }

      const { data: personData, error: personError } = await supabase
        .from('people')
        .upsert(personRecord, { onConflict: 'id' })
        .select('id')
        .single()

      if (personError) { errors.push(`${name}: ${personError.message}`); continue }

      const personId = personData.id
      isUpdate ? updated++ : imported++

      // Upsert a contribution entry for this person if total_contribution is provided
      const total = parseFloat(row['total_contribution'] ?? '')
      if (!isNaN(total) && total > 0) {
        const { data: existing } = await supabase
          .from('contributions')
          .select('id')
          .eq('person_id', personId)
          .eq('note', 'sheet_import')
          .maybeSingle()

        if (existing) {
          await supabase
            .from('contributions')
            .update({ amount: total })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('contributions')
            .insert({ person_id: personId, amount: total, note: 'sheet_import', date: new Date().toISOString().slice(0, 10) })
        }
      }
    }

    return NextResponse.json({ imported, updated, errors })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
