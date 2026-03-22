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
    let imported = 0, updated = 0
    const errors: string[] = []

    for (const row of rows) {
      const name = row['name']
      if (!name) { errors.push(`Skipped row: missing name`); continue }

      const record = {
        ...(row['id'] ? { id: row['id'] } : {}),
        name,
        hod: row['hod'] || '',
      }

      const { error } = await supabase
        .from('departments')
        .upsert(record, { onConflict: 'id' })

      if (error) { errors.push(`${name}: ${error.message}`); continue }
      row['id'] ? updated++ : imported++
    }

    return NextResponse.json({ imported, updated, errors })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
