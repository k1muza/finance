import type { User } from '@supabase/supabase-js'
import type {
  DistrictAction,
  DistrictRole,
  LegacyDistrictRole,
} from '@/lib/auth/permissions'
import { can, normalizeDistrictRole } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { ApiRouteError } from '@/lib/server/errors'

type ServerSupabase = ReturnType<typeof createServerClient>

export interface DistrictActor {
  user: User
  role: DistrictRole | null
  isSuperuser: boolean
}

export async function requireAuthenticatedUser(
  supabase: ServerSupabase,
  token: string | null | undefined,
): Promise<User> {
  if (!token) {
    throw new ApiRouteError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new ApiRouteError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  return user
}

export async function resolveDistrictActor(
  supabase: ServerSupabase,
  token: string | null | undefined,
  districtId: string,
): Promise<DistrictActor> {
  const user = await requireAuthenticatedUser(supabase, token)

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_superuser')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.is_superuser) {
    return { user, role: null, isSuperuser: true }
  }

  const { data: membership } = await supabase
    .from('district_users')
    .select('role')
    .eq('district_id', districtId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return {
    user,
    role: normalizeDistrictRole((membership?.role ?? null) as LegacyDistrictRole | null),
    isSuperuser: false,
  }
}

export async function requireDistrictAction(
  supabase: ServerSupabase,
  token: string | null | undefined,
  districtId: string,
  action: DistrictAction,
): Promise<DistrictActor> {
  const actor = await resolveDistrictActor(supabase, token, districtId)

  if (!can(action, actor.role, actor.isSuperuser)) {
    throw new ApiRouteError(
      'ACTION_FORBIDDEN',
      'You do not have permission to perform this action in the selected district.',
      403,
    )
  }

  return actor
}
