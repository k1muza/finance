import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/data/leaderboard?district_id=<uuid>
// Returns the live leaderboard view, optionally scoped to a district.
export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const districtId = request.nextUrl.searchParams.get('district_id')

  let query = supabase
    .from('leaderboard')
    .select('*')
    .order('rank')

  if (districtId) query = query.eq('district_id', districtId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
