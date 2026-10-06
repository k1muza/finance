import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { PreferencesSettingsPage } from '@/components/settings/SettingsSections'

// No district selected: only personal preferences apply. District sections live
// under /district/[districtId]/settings/*.
export default function SettingsPage() {
  return (
    <SettingsLayout>
      <PreferencesSettingsPage />
    </SettingsLayout>
  )
}
