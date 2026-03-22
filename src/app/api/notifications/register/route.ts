import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Called by the Flutter app on launch to register / refresh its FCM token.
// POST { token: string, platform: "android" | "ios" }
export async function POST(request: Request) {
  const { token, platform } = await request.json()

  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase
    .from('device_tokens')
    .upsert({ token, platform: platform ?? null }, { onConflict: 'token' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
