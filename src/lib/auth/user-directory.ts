import type { createServerClient } from '@/lib/supabase/server'

type ServerSupabase = ReturnType<typeof createServerClient>

export interface UserDirectoryEntry {
  display_name: string | null
  email: string | null
}

/** Display names and emails for the given users (service-role client only). */
export async function loadUserDirectory(
  supabase: ServerSupabase,
  userIds: string[],
): Promise<Record<string, UserDirectoryEntry>> {
  const ids = [...new Set(userIds)]
  const directory: Record<string, UserDirectoryEntry> = {}
  if (ids.length === 0) return directory

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, display_name')
    .in('id', ids)

  for (const id of ids) directory[id] = { display_name: null, email: null }
  for (const p of profiles ?? []) directory[p.id].display_name = p.display_name

  await Promise.all(ids.map(async (uid) => {
    const { data } = await supabase.auth.admin.getUserById(uid)
    if (data?.user?.email) directory[uid].email = data.user.email
  }))

  return directory
}
