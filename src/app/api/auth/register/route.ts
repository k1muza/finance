import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_REGISTRATION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Registration is currently disabled.' }, { status: 403 })
  }

  const { email, password, district_id } = await request.json()

  if (!email || !password || !district_id) {
    return NextResponse.json({ error: 'Email, password, and district are required.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: district, error: districtError } = await supabase
    .from('districts')
    .select('id')
    .eq('id', district_id)
    .single()

  if (districtError || !district) {
    return NextResponse.json({ error: 'Selected district is not available.' }, { status: 400 })
  }

  // Create the auth user
  const { data: userData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Insert the profile as a district user linked to the selected district
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: userData.user.id, role: 'district', district_id })

  if (profileError) {
    // Roll back: delete the auth user so there's no orphan
    await supabase.auth.admin.deleteUser(userData.user.id)
    return NextResponse.json({ error: 'Failed to create profile. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
