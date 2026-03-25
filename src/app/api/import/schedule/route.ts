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

    // Cache day and session lookups to avoid redundant DB calls within the same import
    const dayCache: Record<string, string> = {}    // date → day_id
    const sessionCache: Record<string, string> = {} // `${day_id}::${name}` → session_id
    const mealCache: Record<string, string> = {}    // `${day_id}::meal::${name}` → meal_id

    for (const row of rows) {
      const date = row['date']?.trim()
      const sessionName = row['session_name']?.trim()

      if (!date) { errors.push(`Skipped row: missing date`); continue }
      if (!sessionName) { errors.push(`${date}: missing session_name`); continue }

      const sessionStart = row['session_start']?.trim()
      const sessionDuration = parseInt(row['session_duration'] ?? '60')
      if (!sessionStart) { errors.push(`${date} / ${sessionName}: missing session_start`); continue }

      const sessionType = row['session_type']?.trim() || 'service'

      // ── 1. Upsert day ──────────────────────────────────────────
      let dayId = dayCache[date]
      if (!dayId) {
        const { data: day, error: dayErr } = await supabase
          .from('days')
          .upsert(
            { district_id: districtId, date, label: row['label']?.trim() || null },
            { onConflict: 'district_id,date' }
          )
          .select('id')
          .single()

        if (dayErr || !day) { errors.push(`${date}: ${dayErr?.message ?? 'failed to upsert day'}`); continue }
        dayId = day.id
        dayCache[date] = dayId
      }

      // ── 2a. Meal row — upsert into meals table and skip event logic ──
      if (sessionType === 'meal') {
        const mealKey = `${dayId}::meal::${sessionName}`
        if (!mealCache[mealKey]) {
          const { data: meal, error: mealErr } = await supabase
            .from('meals')
            .upsert(
              { day_id: dayId, name: sessionName, scheduled_time: sessionStart, duration: sessionDuration },
              { onConflict: 'day_id,name' }
            )
            .select('id')
            .single()

          if (mealErr || !meal) { errors.push(`${date} / ${sessionName}: ${mealErr?.message ?? 'failed to upsert meal'}`); continue }
          mealCache[mealKey] = meal.id
          updated++
        }
        continue
      }

      // ── 2b. Upsert session ─────────────────────────────────────
      const sessionKey = `${dayId}::${sessionName}`
      let sessionId = sessionCache[sessionKey]
      if (!sessionId) {
        const { data: session, error: sessErr } = await supabase
          .from('sessions')
          .upsert(
            { day_id: dayId, name: sessionName, start_time: sessionStart, allocated_duration: sessionDuration },
            { onConflict: 'day_id,name' }
          )
          .select('id')
          .single()

        if (sessErr || !session) { errors.push(`${date} / ${sessionName}: ${sessErr?.message ?? 'failed to upsert session'}`); continue }
        sessionId = session.id
        sessionCache[sessionKey] = sessionId
        updated++ // count session upserts toward updated
      }

      // ── 3. Insert event (if present) ──────────────────────────
      const eventTitle = row['event_title']?.trim()
      if (!eventTitle) continue

      const eventStart = row['event_start']?.trim()
      if (!eventStart) { errors.push(`${date} / ${sessionName} / ${eventTitle}: missing event_start`); continue }
      const eventDuration = parseInt(row['event_duration'] ?? '30')

      // Skip if this event already exists in this session
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('session_id', sessionId)
        .eq('title', eventTitle)
        .maybeSingle()

      if (existing) { updated++; continue }

      const { error: evtErr } = await supabase
        .from('events')
        .insert({ session_id: sessionId, title: eventTitle, start_time: eventStart, duration: eventDuration })

      if (evtErr) { errors.push(`${date} / ${sessionName} / ${eventTitle}: ${evtErr.message}`); continue }
      imported++
    }

    return NextResponse.json({ imported, updated, errors })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
