// DELETE /api/districts/[id]/departments/[departmentId]/members/[userId]

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireDepartmentMemberManager } from '@/lib/auth/departments-server'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'

type Params = { params: Promise<{ id: string; departmentId: string; userId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: districtId, departmentId, userId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const supabase = createServerClient()

  try {
    await requireDepartmentMemberManager(supabase, token, districtId, departmentId)

    const { error } = await supabase
      .from('department_members')
      .delete()
      .eq('department_id', departmentId)
      .eq('user_id', userId)
    if (error) throw new ApiRouteError('DEPARTMENT_MEMBER_DELETE_FAILED', error.message, 500)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
