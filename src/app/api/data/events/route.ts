import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        session:sessions(id, name, day:days(id, date)),
        person:people(id, name),
        videos:event_videos(id, youtube_id, title, created_at),
        commentaries:event_commentaries(id, speaker_name, body, speaker:people(id, name), created_at),
        photos:event_photos(id, url, caption, taken_at, created_at)
      `)
      .order('start_time')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (data ?? []).map((e: any) => ({
      id: e.id,
      session_id: e.session_id,
      session: Array.isArray(e.session) ? (e.session[0] ?? null) : e.session,
      title: e.title,
      allocated_person: Array.isArray(e.person) ? (e.person[0] ?? null) : e.person,
      start_time: e.start_time,
      duration: e.duration,
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
