// POST /api/districts/[id]/departments/[departmentId]/members — add a district user
// Body: { user_id: string }

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireDepartmentMemberManager } from '@/lib/auth/departments-server'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'

type Params = { params: Promise<{ id: string; departmentId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id: districtId, departmentId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const supabase = createServerClient()

  try {
    const actor = await requireDepartmentMemberManager(supabase, token, districtId, departmentId)

    let body: { user_id?: unknown }
    try { body = await req.json() } catch {
      throw new ApiRouteError('INVALID_JSON', 'Invalid JSON body', 400)
    }
    if (typeof body.user_id !== 'string' || !body.user_id) {
      throw new ApiRouteError('USER_REQUIRED', 'Choose a person to add.', 400)
    }

    const { data: districtUser } = await supabase
      .from('district_users')
      .select('user_id')
      .eq('district_id', districtId)
      .eq('user_id', body.user_id)
      .eq('is_active', true)
      .maybeSingle()
    if (!districtUser) {
      throw new ApiRouteError('NOT_DISTRICT_USER', 'Only people with access to this district can join a department.', 422)
    }

    const { error } = await supabase
      .from('department_members')
      .upsert(
        { department_id: departmentId, user_id: body.user_id, added_by: actor.user.id },
        { onConflict: 'department_id,user_id', ignoreDuplicates: true },
      )
    if (error) throw new ApiRouteError('DEPARTMENT_MEMBER_SAVE_FAILED', error.message, 500)

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
