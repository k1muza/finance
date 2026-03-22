import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = createServerClient()

  // Delete all people — cascades to contributions, district_roles, region_roles, and department_roles
  const { error } = await supabase.from('people').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'All people deleted successfully.' })
}
