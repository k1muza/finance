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
  const setupRequired = isAdmin ? districts.length === 0 : !districtId
  const needsSetup = !loading && !isSetup && setupRequired
  const shouldLeaveSetup = !loading && isSetup && !setupRequired

  useEffect(() => {
    if (needsSetup) router.replace('/dashboard/setup')
    if (shouldLeaveSetup) router.replace('/dashboard/overview')
  }, [needsSetup, shouldLeaveSetup, router])

  // Only keep setup visible when setup is actually still required.
  if (isSetup && !shouldLeaveSetup) return <>{children}</>

  // Block children until we know whether to redirect
  if (loading || needsSetup || shouldLeaveSetup) return <PageSpinner />

  return <>{children}</>
}
