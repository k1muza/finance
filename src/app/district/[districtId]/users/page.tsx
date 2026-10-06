import { redirect } from 'next/navigation'
import { districtPath } from '@/lib/district-routes'

// Users & roles moved into Settings; keep old links working.
export default async function UsersRedirect({ params }: PageProps<'/district/[districtId]/users'>) {
  const { districtId } = await params
  redirect(`${districtPath(districtId, 'settings')}/users`)
}
