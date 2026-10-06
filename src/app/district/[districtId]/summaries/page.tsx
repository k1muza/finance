import { redirect } from 'next/navigation'
import { districtPath } from '@/lib/district-routes'

export default async function SummariesPage({ params }: PageProps<'/district/[districtId]/summaries'>) {
  const { districtId } = await params
  redirect(districtPath(districtId, 'summaries/financial'))
}
