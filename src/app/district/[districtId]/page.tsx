import { redirect } from 'next/navigation'
import { districtPath } from '@/lib/district-routes'

export default async function DistrictPage({ params }: PageProps<'/district/[districtId]'>) {
  const { districtId } = await params
  redirect(districtPath(districtId))
}
