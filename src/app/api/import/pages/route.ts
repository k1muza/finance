import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { parseCsv } from '@/lib/csv'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const districtId = (formData.get('district_id') as string | null)?.trim()
    if (!districtId) return NextResponse.json({ error: 'No active district selected' }, { status: 400 })

    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) return NextResponse.json({ imported: 0, updated: 0, errors: [] })

    const supabase = createServerClient()
    let imported = 0, updated = 0
    const errors: string[] = []

    for (const row of rows) {
      const title = row['title']?.trim()
      const slug = row['slug']?.trim()

      if (!title) { errors.push(`Skipped row: missing title`); continue }
      if (!slug) { errors.push(`${title}: missing slug`); continue }

      // Check if this slug already exists for the district
      const { data: existing } = await supabase
        .from('pages')
        .select('id')
        .eq('district_id', districtId)
        .eq('slug', slug)
        .maybeSingle()

      const record = {
        district_id: districtId,
        title,
        slug,
        content:           row['content']?.trim()    || null,
        icon_class:        row['icon_class']?.trim() || null,
        sort_order:        parseInt(row['sort_order'] ?? '0') || 0,
        published:         row['published']?.trim().toLowerCase() === 'true',
        featured_image_url: row['featured_image_url']?.trim() || null,
      }

      if (existing) {
        const { error: updateErr } = await supabase
          .from('pages')
          .update(record)
          .eq('id', existing.id)

        if (updateErr) { errors.push(`${title}: ${updateErr.message}`); continue }
        updated++
      } else {
        const { error: insertErr } = await supabase
          .from('pages')
          .insert(record)

        if (insertErr) { errors.push(`${title}: ${insertErr.message}`); continue }
        imported++
      }
    }

    return NextResponse.json({ imported, updated, errors })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
