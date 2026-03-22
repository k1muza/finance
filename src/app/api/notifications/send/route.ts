import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { messaging } from '@/lib/firebase/admin'

// POST { title, body, type }
export async function POST(request: Request) {
  const { title, body, type } = await request.json()

  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 })

  const supabase = createServerClient()

  // Fetch all registered tokens
  const { data: rows, error: fetchErr } = await supabase
    .from('device_tokens')
    .select('token')

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const tokens = (rows ?? []).map((r) => r.token)

  let sent = 0
  const staleTokens: string[] = []

  if (tokens.length > 0) {
    // FCM allows max 500 tokens per multicast call
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500)
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: { type: type ?? 'general' },
        android: { priority: 'high' },
        apns: { payload: { aps: { contentAvailable: true } } },
      })

      sent += response.successCount

      // Collect tokens that are no longer valid so we can clean them up
      response.responses.forEach((r, idx) => {
        if (!r.success) staleTokens.push(batch[idx])
      })
    }

    // Remove stale / unregistered tokens
    if (staleTokens.length > 0) {
      await supabase.from('device_tokens').delete().in('token', staleTokens)
    }
  }

  // Record in history
  await supabase.from('notifications').insert({
    title,
    body,
    type: type ?? 'general',
    recipient_count: sent,
  })

  return NextResponse.json({ sent, total: tokens.length, stale: staleTokens.length })
}
