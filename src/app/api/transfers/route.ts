import { NextRequest, NextResponse } from 'next/server'
import { requireDistrictAction } from '@/lib/auth/server'
import {
  hydrateTransfers,
  validateDraftTransferPayload,
} from '@/lib/finance/transfer-server'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'
import { createServerClient } from '@/lib/supabase/server'
import type { TransferStatus } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  try {
    const { searchParams } = req.nextUrl
    const districtId = searchParams.get('district_id')
    const status = searchParams.get('status') as TransferStatus | null
    const accountId = searchParams.get('account_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    if (!districtId) {
      throw new ApiRouteError('DISTRICT_ID_REQUIRED', 'district_id is required.', 400)
    }

    await requireDistrictAction(supabase, token, districtId, 'transfers.view')

    let query = supabase
      .from('transfers')
      .select('*')
      .eq('district_id', districtId)
      .order('transfer_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (dateFrom) query = query.gte('transfer_date', dateFrom)
    if (dateTo) query = query.lte('transfer_date', dateTo)
    if (accountId) {
      query = query.or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
    }

    const { data, error } = await query

    if (error) {
      throw new ApiRouteError('TRANSFER_LIST_FAILED', error.message, 500)
    }

    return NextResponse.json({ data: await hydrateTransfers(supabase, data ?? []) })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')

  let body: {
    district_id: string
    transfer_date: string
    from_account_id: string
    to_account_id: string
    amount: number
    description?: string | null
    client_generated_id?: string | null
    device_id?: string | null
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
    const actor = await requireDistrictAction(
      supabase,
      token,
      body.district_id,
      'transfers.draft',
    )

    const validated = await validateDraftTransferPayload(supabase, body)

    if (validated.values.client_generated_id) {
      const { data: existing, error: existingError } = await supabase
        .from('transfers')
        .select('*')
        .eq('client_generated_id', validated.values.client_generated_id)
        .maybeSingle()

      if (existingError) {
        throw new ApiRouteError('TRANSFER_LOOKUP_FAILED', existingError.message, 500)
      }

      if (existing) {
        if (existing.district_id !== validated.values.district_id) {
          throw new ApiRouteError(
            'CLIENT_GENERATED_ID_CONFLICT',
            'client_generated_id already exists for another transfer.',
            409,
          )
        }

        const [hydratedExisting] = await hydrateTransfers(supabase, [existing])
        return NextResponse.json({ data: hydratedExisting, deduplicated: true })
      }
    }

    const { data, error } = await supabase
      .from('transfers')
      .insert({
        ...validated.values,
        status: 'draft',
        captured_by_user_id: actor.user.id,
      })
      .select('*')
      .single()

    if (error || !data) {
      throw new ApiRouteError(
        'TRANSFER_CREATE_FAILED',
        error?.message ?? 'Failed to create transfer.',
        500,
      )
    }

    const [hydrated] = await hydrateTransfers(supabase, [data])
    return NextResponse.json({ data: hydrated }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
