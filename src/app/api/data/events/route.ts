import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const districtId = request.nextUrl.searchParams.get('district_id')

    let query = supabase
      .from('events')
      .select(`
        *,
        session:sessions!inner(id, name, day:days!inner(id, date)),
        event_people(person:people(id, name)),
        videos:event_videos(id, youtube_id, title, created_at),
        commentaries:event_commentaries(id, speaker_name, body, speaker:people(id, name), created_at),
        photos:event_photos(id, url, caption, taken_at, created_at)
      `)
      .order('start_time')

    if (districtId) query = query.eq('sessions.days.district_id', districtId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (data ?? []).map((e: any) => ({
      id: e.id,
      session_id: e.session_id,
      session: Array.isArray(e.session) ? (e.session[0] ?? null) : e.session,
      title: e.title,
      start_time: e.start_time,
      duration: e.duration,
      is_main_event: e.is_main_event,
      people: (e.event_people ?? []).map((ep: any) => (Array.isArray(ep.person) ? ep.person[0] : ep.person)).filter(Boolean),
      videos: e.videos ?? [],
      commentaries: (e.commentaries ?? []).map((c: any) => ({
        ...c,
        speaker: Array.isArray(c.speaker) ? (c.speaker[0] ?? null) : c.speaker,
      })),
      photos: e.photos ?? [],
    }))

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
