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

    await requireDistrictAction(supabase, token, transfer.district_id, 'transfers.draft')

    if (!canTransitionTransfer(transfer.status, 'voided')) {
      throw new ApiRouteError(
        'INVALID_TRANSFER_STATUS_TRANSITION',
        `Cannot void a transfer with status '${transfer.status}'. Only drafts may be voided.`,
        422,
      )
    }

    const { data, error } = await supabase
      .from('transfers')
      .update({ status: 'voided' })
      .eq('id', id)
      .eq('status', 'draft')
      .select('*')
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'TRANSFER_VOID_FAILED',
        error?.message ?? 'Failed to void transfer.',
        500,
      )
    }

    const [hydratedTransfer] = await hydrateTransfers(supabase, [data])
    return NextResponse.json({ data: hydratedTransfer })
  } catch (error) {
    return toErrorResponse(error)
  }
}
