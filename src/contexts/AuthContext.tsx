'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { District } from '@/types'
import { DistrictRole, normalizeDistrictRole } from '@/lib/auth/permissions'

export type { DistrictRole }

const PROFILE_CACHE_KEY = 'finance_profile'

export interface DistrictMembership {
  district: District
  role: DistrictRole
}

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [memberships, setMemberships] = useState<DistrictMembership[]>([])
  const [activeDistrictId, setActiveDistrictId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchSession = async (userId: string) => {
    try {
      // Try new schema first (user_profiles + district_users)
      const [{ data: profile }, { data: memberRows }] = await Promise.all([
        supabase.from('user_profiles').select('is_superuser').eq('id', userId).single(),
        supabase.from('district_users').select('role, district:districts(*)').eq('user_id', userId).eq('is_active', true),
      ])

      // If the new tables exist and have data, use them
      if (profile || (memberRows && memberRows.length > 0)) {
        const up: UserProfile = { is_superuser: profile?.is_superuser ?? false }
        const ms: DistrictMembership[] = (memberRows ?? [])
          .filter((r) => r.district != null)
          .flatMap((r) => {
            const role = normalizeDistrictRole(
              (r.role ?? null) as DistrictRole | 'preparer' | 'approver' | null,
            )

            if (!role) return []

            return [{
              district: r.district as unknown as District,
              role,
            }]
          })

        setUserProfile(up)
        setMemberships(ms)
        setActiveDistrictId((prev) => {
          if (prev) return prev
          return ms.length === 1 ? ms[0].district.id : null
        })

        const cached: CachedSession = { userProfile: up, memberships: ms, activeDistrictId: null }
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
        const ms: DistrictMembership[] = legacyDistrict
          ? [{ district: legacyDistrict, role: legacyProfile.role === 'admin' ? 'admin' : 'treasurer' }]
          : []

        setUserProfile(up)
        setMemberships(ms)
        setActiveDistrictId((prev) => {
          if (prev) return prev
          return legacyProfile.district_id ?? null
        })

        const cached: CachedSession = { userProfile: up, memberships: ms, activeDistrictId: legacyProfile.district_id ?? null }
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached))
      }
    } catch {
      // Offline: restore from cache
      try {
        const raw = localStorage.getItem(PROFILE_CACHE_KEY)
        if (raw) {
          const cached: CachedSession = JSON.parse(raw)
          setUserProfile(cached.userProfile)
          setMemberships(cached.memberships)
          setActiveDistrictId((prev) => prev ?? cached.activeDistrictId ?? null)
        }
      } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchSession(session.user.id).finally(() => setLoading(false))
      } else if (!navigator.onLine) {
        try {
          const raw = localStorage.getItem(PROFILE_CACHE_KEY)
          if (raw) {
            const cached: CachedSession = JSON.parse(raw)
            setUserProfile(cached.userProfile)
            setMemberships(cached.memberships)
            setActiveDistrictId(cached.activeDistrictId ?? null)
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

      // TOKEN_REFRESHED fires on every tab focus — the user and their memberships
      // haven't changed, so skip the full re-fetch and only keep the user object current.
      if (event === 'TOKEN_REFRESHED') {
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
        setActiveDistrictId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  const logout = async () => {
    localStorage.removeItem(PROFILE_CACHE_KEY)
    await supabase.auth.signOut()
  }

  const refreshMemberships = async () => {
    if (user) await fetchSession(user.id)
  }

  const isAdmin = userProfile?.is_superuser ?? false
  const district = memberships.find((m) => m.district.id === activeDistrictId)?.district ?? null

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      memberships,
      district,
      districtId: activeDistrictId,
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
