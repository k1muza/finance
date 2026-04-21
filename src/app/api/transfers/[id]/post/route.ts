import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { canTransitionTransfer } from '@/lib/finance/transfers'
import { hydrateTransfers } from '@/lib/finance/transfer-server'
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
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .select('id, district_id, status')
      .eq('id', id)
      .maybeSingle()

    if (transferError || !transfer) {
      throw new ApiRouteError('TRANSFER_NOT_FOUND', 'Transfer not found.', 404)
    }

    const actor = await requireDistrictAction(supabase, token, transfer.district_id, 'transfers.post')

    if (transfer.status !== 'posted' && !canTransitionTransfer(transfer.status, 'posted')) {
      throw new ApiRouteError(
        'INVALID_TRANSFER_STATUS_TRANSITION',
        `Cannot post a transfer with status '${transfer.status}'.`,
        422,
      )
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('post_transfer', {
      p_transfer_id: id,
      p_actor_id: actor.user.id,
    })

    if (rpcError || !rpcData) {
      throw new ApiRouteError(
        'TRANSFER_POST_FAILED',
        rpcError?.message ?? 'Failed to post transfer.',
        500,
      )
    }

    const [hydratedTransfer] = await hydrateTransfers(supabase, [rpcData])
    return NextResponse.json({ data: hydratedTransfer })
  } catch (error) {
    return toErrorResponse(error)
  }
}
