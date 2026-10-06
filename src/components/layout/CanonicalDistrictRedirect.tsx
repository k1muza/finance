'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { canonicalDistrictPathFromLegacy } from '@/lib/district-routes'
import { PageSpinner } from '@/components/ui/Spinner'

export function CanonicalDistrictRedirect({ children }: { children: React.ReactNode }) {
  const { districtId, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const destination = districtId
    ? canonicalDistrictPathFromLegacy(pathname, districtId)
    : null

  useEffect(() => {
    if (!loading && destination) router.replace(destination)
  }, [destination, loading, router])

  if (!loading && destination) return <PageSpinner />
  return <>{children}</>
}
