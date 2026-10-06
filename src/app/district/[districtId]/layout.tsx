import { DashboardShell } from '@/components/layout/DashboardShell'
import { DistrictRouteSync } from '@/components/layout/DistrictRouteSync'

export const dynamic = 'force-dynamic'

export default async function DistrictLayout({
  children,
  params,
}: LayoutProps<'/district/[districtId]'>) {
  const { districtId } = await params

  return (
    <DistrictRouteSync districtId={districtId}>
      <DashboardShell>{children}</DashboardShell>
    </DistrictRouteSync>
  )
}
