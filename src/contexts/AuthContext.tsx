'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { District } from '@/types'

const PROFILE_CACHE_KEY = 'conf_profile'

interface Profile {
  district_id: string | null
  role: 'admin' | 'district'
}

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  district: District | null
  districtId: string | null
  isAdmin: boolean
  loading: boolean
  logout: () => Promise<void>
  // Admin-only: the district currently being viewed (null = all districts)
  activeDistrictId: string | null
  setActiveDistrictId: (id: string | null) => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  district: null,
  districtId: null,
  isAdmin: true,
  loading: true,
  logout: async () => {},
  activeDistrictId: null,
  setActiveDistrictId: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [district, setDistrict] = useState<District | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDistrictId, setActiveDistrictId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('district_id, role, district:districts(*)')
        .eq('id', userId)
        .single()

      if (data) {
        const profileData: Profile = { district_id: data.district_id, role: data.role as 'admin' | 'district' }
        const districtData = (data.district as unknown as District) ?? null
        setProfile(profileData)
        setDistrict(districtData)
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ profile: profileData, district: districtData }))
      }
    } catch {
      // Offline: restore from cache so the user can still access the app
      try {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY)
        if (cached) {
          const { profile: p, district: d } = JSON.parse(cached)
          setProfile(p)
          setDistrict(d)
        }
      } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else if (!navigator.onLine) {
        // Offline and no fresh session — restore from cache so the app stays usable
        try {
          const cached = localStorage.getItem(PROFILE_CACHE_KEY)
          if (cached) {
            const { profile: p, district: d } = JSON.parse(cached)
            setProfile(p)
            setDistrict(d)
            // Keep user non-null so guards don't redirect; real session check happens when back online
            setUser({ id: p.district_id ?? 'offline' } as User)
          }
        } catch { /* ignore */ }
        setLoading(false)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore SIGNED_OUT when offline — it's just a failed token refresh, not a real logout
      if (event === 'SIGNED_OUT' && !navigator.onLine) return

      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setDistrict(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  const logout = async () => {
    localStorage.removeItem(PROFILE_CACHE_KEY)
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'
  // For admins, districtId reflects the actively selected district (null = show all)
  const districtId = isAdmin ? activeDistrictId : (profile?.district_id ?? null)

  return (
    <AuthContext.Provider value={{
      user, profile, district, districtId, isAdmin, loading, logout,
      activeDistrictId, setActiveDistrictId,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
