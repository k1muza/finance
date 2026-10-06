import { SettingsLayout } from '@/components/settings/SettingsLayout'

export default function DistrictSettingsLayout({ children }: LayoutProps<'/district/[districtId]/settings'>) {
  return <SettingsLayout>{children}</SettingsLayout>
}
