'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { District } from '@/types'
import { DistrictRole, normalizeDistrictRole } from '@/lib/auth/permissions'
import { useAppUiStore } from '@/stores/app-ui-store'

export type { DistrictRole }

const PROFILE_CACHE_KEY = 'finance_profile'

export interface DistrictMembership {
  district: District
  role: DistrictRole
  /** Region, assembly or ministry a scoped role is tied to. */
  scopeMemberId?: string | null
  /** Department a departmental role is tied to. */
  scopeDepartmentId?: string | null
  /** Member of a department with finance view rights (the Finance Committee). */
  financeCommittee?: boolean
}

interface FinanceDepartmentRef {
  district_id: string
  grants_finance_view: boolean
  is_active: boolean
}

const grantsFinanceView = (d: FinanceDepartmentRef | null | undefined) =>
  Boolean(d?.grants_finance_view && d.is_active)

interface UserProfile {
  is_superuser: boolean
}

interface AuthContextValue {
  user: User | null
  userProfile: UserProfile | null
  /** All districts this user is an active member of. */
  memberships: DistrictMembership[]
  /** The district currently being worked in (derived from districtId + memberships). */
  district: District | null
  /** The ID of the district currently being worked in. */
  districtId: string | null
  isAdmin: boolean
  loading: boolean
  logout: () => Promise<void>
  setActiveDistrictId: (id: string | null) => void
  /** Re-fetches memberships from the server (e.g. after creating a district). */
  refreshMemberships: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userProfile: null,
  memberships: [],
  district: null,
  districtId: null,
  isAdmin: false,
  loading: true,
  logout: async () => {},
  setActiveDistrictId: () => {},
  refreshMemberships: async () => {},
})

interface CachedSession {
  userProfile: UserProfile
  memberships: DistrictMembership[]
  activeDistrictId: string | null
}

function resolveActiveDistrictId(
  memberships: DistrictMembership[],
  preferredDistrictId: string | null,
) {
  if (preferredDistrictId && memberships.some((membership) => membership.district.id === preferredDistrictId)) {
    return preferredDistrictId
  }

  return memberships.length === 1 ? memberships[0].district.id : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [memberships, setMemberships] = useState<DistrictMembership[]>([])
  const [loading, setLoading] = useState(true)
  const activeDistrictId = useAppUiStore((state) => state.activeDistrictId)
  const hasHydratedAppUiState = useAppUiStore((state) => state.hasHydrated)
  const setStoredActiveDistrictId = useAppUiStore((state) => state.setActiveDistrictId)
  const resetAppUiState = useAppUiStore((state) => state.resetAppUiState)

  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null
  }, [user])

  const supabase = createClient()

  const fetchSession = async (userId: string) => {
    try {
      // Try new schema first (user_profiles + district_users)
      const [
        { data: profile, error: profileError },
        { data: memberRows, error: memberError },
        { data: departmentRows },
      ] = await Promise.all([
        supabase.from('user_profiles').select('is_superuser').eq('id', userId).single(),
        supabase
          .from('district_users')
          .select('role, scope_member_id, scope_department_id, scope_department:departments(district_id, grants_finance_view, is_active), district:districts(*)')
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('department_members')
          .select('department:departments(district_id, grants_finance_view, is_active)')
          .eq('user_id', userId),
      ])
      const financeCommitteeDistricts = new Set(
        (departmentRows ?? [])
          .map((r) => r.department as unknown as FinanceDepartmentRef | null)
          .filter(grantsFinanceView)
          .map((d) => d!.district_id),
      )
      // A failed query must not look like "no memberships" — that would clear the
      // active district. Throw so the cached session is used instead.
      // PGRST116 is .single() finding no row, which is a legitimate empty result.
      if (profileError && profileError.code !== 'PGRST116') throw profileError
      if (memberError) throw memberError

      // If the new tables exist and have data, use them
      if (profile || (memberRows && memberRows.length > 0)) {
        const up: UserProfile = { is_superuser: profile?.is_superuser ?? false }
        const { data: superuserDistricts, error: districtsError } = up.is_superuser
          ? await supabase.from('districts').select('*').eq('is_active', true).order('name')
          : { data: null, error: null }
        if (districtsError) throw districtsError
        const ms: DistrictMembership[] = up.is_superuser
          ? (superuserDistricts ?? []).map((district) => ({
              district: district as District,
              role: 'district_pastor' as const,
            }))
          : (memberRows ?? [])
          .filter((r) => r.district != null && (r.district as unknown as District).is_active !== false)
          .flatMap((r) => {
            const role = normalizeDistrictRole(
              (r.role ?? null) as DistrictRole | 'preparer' | 'approver' | null,
            )

            if (!role) return []

            const district = r.district as unknown as District
            return [{
              district,
              role,
              scopeMemberId: r.scope_member_id ?? null,
              scopeDepartmentId: r.scope_department_id ?? null,
              financeCommittee:
                financeCommitteeDistricts.has(district.id)
                || grantsFinanceView(r.scope_department as unknown as FinanceDepartmentRef | null),
            }]
          })
        const resolvedActiveDistrictId = resolveActiveDistrictId(
          ms,
          useAppUiStore.getState().activeDistrictId,
        )

        setUserProfile(up)
        setMemberships(ms)
        setStoredActiveDistrictId(resolvedActiveDistrictId)

        const cached: CachedSession = {
          userProfile: up,
          memberships: ms,
          activeDistrictId: resolvedActiveDistrictId,
        }
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached))
        return
      }

      // Fallback: legacy profiles table (pre-migration state)
      const { data: legacyProfile } = await supabase
        .from('profiles')
        .select('district_id, role, district:districts(*)')
        .eq('id', userId)
        .single()

      if (legacyProfile) {
        const up: UserProfile = { is_superuser: legacyProfile.role === 'admin' }
        const legacyDistrict = legacyProfile.district as unknown as District | null
        const ms: DistrictMembership[] = legacyDistrict?.is_active !== false && legacyDistrict
          ? [{ district: legacyDistrict, role: legacyProfile.role === 'admin' ? 'district_pastor' : 'accounting_officer' }]
          : []
        const resolvedActiveDistrictId = resolveActiveDistrictId(
          ms,
          useAppUiStore.getState().activeDistrictId ?? legacyProfile.district_id ?? null,
        )

        setUserProfile(up)
        setMemberships(ms)
        setStoredActiveDistrictId(resolvedActiveDistrictId)

        const cached: CachedSession = {
          userProfile: up,
          memberships: ms,
          activeDistrictId: resolvedActiveDistrictId,
        }
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached))
      }
    } catch {
      // Offline: restore from cache
      try {
        const raw = localStorage.getItem(PROFILE_CACHE_KEY)
        if (raw) {
          const cached: CachedSession = JSON.parse(raw)
          const resolvedActiveDistrictId = resolveActiveDistrictId(
            cached.memberships.filter((membership) => membership.district.is_active !== false),
            useAppUiStore.getState().activeDistrictId ?? cached.activeDistrictId ?? null,
          )
          setUserProfile(cached.userProfile)
          setMemberships(cached.memberships.filter((membership) => membership.district.is_active !== false))
          setStoredActiveDistrictId(resolvedActiveDistrictId)
        }
      } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    if (!hasHydratedAppUiState) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchSession(session.user.id).finally(() => setLoading(false))
      } else if (!navigator.onLine) {
        try {
          const raw = localStorage.getItem(PROFILE_CACHE_KEY)
          if (raw) {
            const cached: CachedSession = JSON.parse(raw)
            const resolvedActiveDistrictId = resolveActiveDistrictId(
              cached.memberships.filter((membership) => membership.district.is_active !== false),
              useAppUiStore.getState().activeDistrictId ?? cached.activeDistrictId ?? null,
            )
            setUserProfile(cached.userProfile)
            setMemberships(cached.memberships.filter((membership) => membership.district.is_active !== false))
            setStoredActiveDistrictId(resolvedActiveDistrictId)
            setUser({ id: 'offline' } as User)
          }
        } catch { /* ignore */ }
        setLoading(false)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !navigator.onLine) return

      // TOKEN_REFRESHED and SIGNED_IN (for the same user) fire on every tab focus —
      // the user and their memberships haven't changed, so skip the full re-fetch and
      // keep the existing user object so hooks keyed on it don't reload.
      if (
        event === 'TOKEN_REFRESHED'
        || (event === 'SIGNED_IN' && session?.user.id === currentUserIdRef.current)
      ) {
        setUser((current) => {
          const nextUser = session?.user ?? null
          if (current?.id && nextUser?.id && current.id === nextUser.id) {
            return current
          }
          return nextUser
        })
        return
      }

      setUser(session?.user ?? null)
      if (session?.user) {
        fetchSession(session.user.id)
      } else {
        setUserProfile(null)
        setMemberships([])
        setStoredActiveDistrictId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [hasHydratedAppUiState]) // eslint-disable-line

  const logout = async () => {
    localStorage.removeItem(PROFILE_CACHE_KEY)
    resetAppUiState()
    await supabase.auth.signOut()
  }

  const refreshMemberships = async () => {
    if (user) await fetchSession(user.id)
  }

  const isAdmin = userProfile?.is_superuser ?? false

  // On /district/[districtId] routes the URL is the source of truth; the store
  // only remembers the last district for routes that don't carry one.
  const params = useParams<{ districtId?: string }>()
  const routeDistrictId = typeof params?.districtId === 'string' ? params.districtId : null
  const routeDistrictAllowed = routeDistrictId !== null
    && memberships.some((m) => m.district.id === routeDistrictId)
  const effectiveDistrictId = routeDistrictAllowed ? routeDistrictId : activeDistrictId

  useEffect(() => {
    if (routeDistrictAllowed && activeDistrictId !== routeDistrictId) {
      setStoredActiveDistrictId(routeDistrictId)
    }
  }, [activeDistrictId, routeDistrictAllowed, routeDistrictId, setStoredActiveDistrictId])

  const district = memberships.find((m) => m.district.id === effectiveDistrictId)?.district ?? null
  const setActiveDistrictId = useCallback((id: string | null) => {
    if (id === null || isAdmin || memberships.some((membership) => membership.district.id === id)) {
      setStoredActiveDistrictId(id)
    }
  }, [isAdmin, memberships, setStoredActiveDistrictId])

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      memberships,
      district,
      districtId: effectiveDistrictId,
      isAdmin,
      loading,
      logout,
      setActiveDistrictId,
      refreshMemberships,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
