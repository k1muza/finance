// POST /api/collections/[id]/submit
// Accounting Officer / Assistant confirms the money reached the office.
// Moves status: open -> submitted (the collection is then locked).

import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { loadCollection, submitCollection } from '@/lib/finance/collection-server'
import { toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  try {
    const collection = await loadCollection(supabase, id)
    const actor = await requireDistrictAction(supabase, token, collection.district_id, 'collections.submit')
    const data = await submitCollection(supabase, collection, actor)
    return NextResponse.json({ data })
  } catch (error) {
    return toErrorResponse(error)
  }
}
