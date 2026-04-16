// PATCH /api/districts/[id]/members/[userId]
// Update a district member's role or active status.
// Body: { role?: DistrictRole, is_active?: boolean }

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { DistrictRole } from '@/lib/auth/permissions'

type Params = { params: Promise<{ id: string; userId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: districtId, userId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Caller must be superuser or district admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_superuser')
    .eq('id', user.id)
    .single()

  if (!profile?.is_superuser) {
    const { data: membership } = await supabase
      .from('district_users')
      .select('role')
      .eq('district_id', districtId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
    if (membership?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let body: { role?: DistrictRole; is_active?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (body.role !== undefined) {
    const validRoles: DistrictRole[] = ['admin', 'secretary', 'treasurer', 'clerk', 'auditor', 'viewer']
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: `Invalid role: ${body.role}` }, { status: 400 })
    }
    patch.role = body.role
  }

  if (body.is_active !== undefined) {
    patch.is_active = body.is_active
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('district_users')
    .update(patch)
    .eq('district_id', districtId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Member not found' }, { status: error ? 500 : 404 })
  }

  return NextResponse.json({ member: updated })
}
