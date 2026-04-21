import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import {
  hydrateTransfers,
  validateDraftTransferPayload,
} from '@/lib/finance/transfer-server'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'

async function readTransferOrThrow(
  supabase: ReturnType<typeof createServerClient>,
  id: string,
) {
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    throw new ApiRouteError('TRANSFER_NOT_FOUND', 'Transfer not found.', 404)
  }

  return data
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  try {
    const transfer = await readTransferOrThrow(supabase, id)

    await requireDistrictAction(supabase, token, transfer.district_id, 'transfers.view')

    const [hydratedTransfer] = await hydrateTransfers(supabase, [transfer])
    const { data: effects, error: effectsError } = await supabase
      .from('cashbook_transactions')
      .select('*, account:accounts(id,name,type,currency,status)')
      .eq('transfer_id', id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (effectsError) {
      throw new ApiRouteError('TRANSFER_EFFECTS_READ_FAILED', effectsError.message, 500)
    }

    return NextResponse.json({
      data: {
        ...hydratedTransfer,
        effect_transactions: effects ?? [],
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  let body: {
    transfer_date?: string
    from_account_id?: string
    to_account_id?: string
    amount?: number
    description?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_JSON' },
      { status: 400 },
    )
  }

  try {
    const transfer = await readTransferOrThrow(supabase, id)

    await requireDistrictAction(supabase, token, transfer.district_id, 'transfers.draft')

    if (transfer.status !== 'draft') {
      throw new ApiRouteError(
        'TRANSFER_DRAFT_EDIT_FORBIDDEN',
        'Only draft transfers can be edited.',
        422,
      )
    }

    const validated = await validateDraftTransferPayload(supabase, {
      district_id: transfer.district_id,
      transfer_date: body.transfer_date ?? transfer.transfer_date,
      from_account_id: body.from_account_id ?? transfer.from_account_id,
      to_account_id: body.to_account_id ?? transfer.to_account_id,
      amount: body.amount ?? transfer.amount,
      description: body.description !== undefined ? body.description : transfer.description,
      client_generated_id: transfer.client_generated_id,
      device_id: transfer.device_id,
    })

    const patch: Record<string, unknown> = {}
    if (validated.values.transfer_date !== transfer.transfer_date) patch.transfer_date = validated.values.transfer_date
    if (validated.values.from_account_id !== transfer.from_account_id) patch.from_account_id = validated.values.from_account_id
    if (validated.values.to_account_id !== transfer.to_account_id) patch.to_account_id = validated.values.to_account_id
    if (validated.values.amount !== transfer.amount) patch.amount = validated.values.amount
    if (validated.values.description !== transfer.description) patch.description = validated.values.description

    if (Object.keys(patch).length === 0) {
      throw new ApiRouteError('NO_CHANGES', 'No fields to update.', 400)
    }

    const { data, error } = await supabase
      .from('transfers')
      .update(patch)
      .eq('id', id)
      .eq('status', 'draft')
      .select('*')
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'TRANSFER_UPDATE_FAILED',
        error?.message ?? 'Failed to update transfer.',
        500,
      )
    }

    const [hydratedTransfer] = await hydrateTransfers(supabase, [data])
    return NextResponse.json({ data: hydratedTransfer })
  } catch (error) {
    return toErrorResponse(error)
  }
}
