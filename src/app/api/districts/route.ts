// POST /api/districts
// Creates a district, registers the creator as admin, and seeds a default fund.
// Body: { name: string }

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only platform superusers can create districts
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_superuser')
    .eq('id', user.id)
    .single()

  if (!profile?.is_superuser) {
    return NextResponse.json({ error: 'Only platform administrators can create districts' }, { status: 403 })
  }

  let body: { name?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Generate a URL-safe slug from the name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  // 1. Create district
  const { data: district, error: distErr } = await supabase
    .from('districts')
    .insert({ name, slug, created_by: user.id })
    .select()
    .single()

  if (distErr || !district) {
    return NextResponse.json({ error: distErr?.message ?? 'Failed to create district' }, { status: 500 })
  }

  // 2. Register creator as district admin
  const { error: memberErr } = await supabase
    .from('district_users')
    .insert({
      district_id: district.id,
      user_id: user.id,
      role: 'admin',
      is_active: true,
    })

  if (memberErr) {
    // Roll back the district on failure
    await supabase.from('districts').delete().eq('id', district.id)
    return NextResponse.json({ error: memberErr.message }, { status: 500 })
  }

  // 3. Seed default "General Fund"
  await supabase.from('funds').insert({
    district_id: district.id,
    name: 'General Fund',
    description: 'Default unrestricted fund',
    is_restricted: false,
  })

  return NextResponse.json({ district }, { status: 201 })
}
