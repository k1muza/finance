'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { District } from '@/types'

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
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  district: null,
  districtId: null,
  isAdmin: true,
  loading: true,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [district, setDistrict] = useState<District | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('district_id, role, district:districts(*)')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile({ district_id: data.district_id, role: data.role as 'admin' | 'district' })
      setDistrict((data.district as unknown as District) ?? null)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'
  const districtId = profile?.district_id ?? null

  return (
    <AuthContext.Provider value={{ user, profile, district, districtId, isAdmin, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
