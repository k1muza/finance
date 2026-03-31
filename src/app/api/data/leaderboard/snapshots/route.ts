import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET  /api/data/leaderboard/snapshots?district_id=<uuid>&limit=<n>
// Returns historical snapshot records, newest first.
//
// POST /api/data/leaderboard/snapshots
// Calls take_leaderboard_snapshot() to freeze the current rankings.

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = request.nextUrl
  const districtId = searchParams.get('district_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '500', 10), 1000)

  let query = supabase
    .from('leaderboard_snapshots')
    .select('id, person_id, district_id, rank, total, snapshot_at')
    .order('snapshot_at', { ascending: false })
    .limit(limit)

  if (districtId) query = query.eq('district_id', districtId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST() {
  const supabase = createServerClient()
  const { error } = await supabase.rpc('take_leaderboard_snapshot')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
