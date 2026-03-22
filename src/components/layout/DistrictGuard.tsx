'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { PageSpinner } from '@/components/ui/Spinner'

export function DistrictGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, districtId, loading: authLoading } = useAuth()
  const { data: districts, loading: districtsLoading } = useDistricts()
  const router = useRouter()
  const pathname = usePathname()

  const isSetup = pathname.startsWith('/dashboard/setup')
  const loading = authLoading || districtsLoading
  const needsSetup = !loading && !isSetup && (
    isAdmin ? districts.length === 0 : !districtId
  )

  useEffect(() => {
    if (needsSetup) router.replace('/dashboard/setup')
  }, [needsSetup, router])

  // Always render setup page as-is
  if (isSetup) return <>{children}</>

  // Block children until we know whether to redirect
  if (loading || needsSetup) return <PageSpinner />

  return <>{children}</>
}
