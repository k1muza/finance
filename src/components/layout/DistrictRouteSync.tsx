'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { PageSpinner } from '@/components/ui/Spinner'

export function DistrictRouteSync({
  districtId: routeDistrictId,
  children,
}: {
  districtId: string
  children: React.ReactNode
}) {
  const { districtId, isAdmin, loading: authLoading, memberships, setActiveDistrictId } = useAuth()
  const { data: activeDistricts, loading: districtsLoading } = useDistricts()
  const router = useRouter()
  const [hasSynchronized, setHasSynchronized] = useState(false)
  const loading = authLoading || districtsLoading
  const allowed = isAdmin
    ? activeDistricts.some((district) => district.id === routeDistrictId)
    : memberships.some((membership) => membership.district.id === routeDistrictId)

  if (!hasSynchronized && !loading && allowed && districtId === routeDistrictId) {
    setHasSynchronized(true)
  }

  useEffect(() => {
    if (loading) return
    if (!allowed) {
      // Otherwise CanonicalDistrictRedirect bounces /dashboard/overview straight back here.
      if (districtId === routeDistrictId) setActiveDistrictId(null)
      router.replace('/dashboard/overview')
      return
    }
    if (!hasSynchronized && districtId !== routeDistrictId) {
      setActiveDistrictId(routeDistrictId)
    }
  },[allowed, districtId, hasSynchronized, loading, routeDistrictId, router, setActiveDistrictId])

  // Only block until the route's district has been applied once. After that the
  // store may briefly differ (e.g. while navigating away), which must not leave
  // the whole shell stuck behind a spinner.
  if (!hasSynchronized && (loading || !allowed || districtId !== routeDistrictId)) return <PageSpinner />
  return <>{children}</>
}
