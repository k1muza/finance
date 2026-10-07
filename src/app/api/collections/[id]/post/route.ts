// POST /api/collections/[id]/post
// Posts each line of a submitted collection as a cashbook receipt.
// Body: { account_id, funds: { [collection_type_id]: fund_id }, transaction_date? }
// Moves status: submitted -> posted

import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { loadCollection, postCollection, type PostCollectionInput } from '@/lib/finance/collection-server'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  try {
    let body: Partial<PostCollectionInput>
    try { body = await req.json() } catch {
      throw new ApiRouteError('INVALID_JSON', 'Invalid JSON body', 400)
    }

    const collection = await loadCollection(supabase, id)
    const actor = await requireDistrictAction(supabase, token, collection.district_id, 'collections.post')
    const result = await postCollection(supabase, collection, actor, {
      account_id: typeof body.account_id === 'string' ? body.account_id : '',
      funds: body.funds && typeof body.funds === 'object' ? body.funds : {},
      transaction_date: typeof body.transaction_date === 'string' && body.transaction_date ? body.transaction_date : undefined,
    })
    return NextResponse.json({ data: result.collection, posted: result.posted })
  } catch (error) {
    return toErrorResponse(error)
  }
}
