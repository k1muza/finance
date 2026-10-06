'use client'

import { useAuth } from '@/contexts/AuthContext'
import { SettingsSectionGate } from '@/components/settings/SettingsLayout'
import { DangerZone, DistrictSettings, PreferencesSection } from '@/components/settings/SettingsPanel'
import { UsersSettings } from '@/components/settings/UsersSettings'

// One component per settings route, each behind its permission gate.

export function GeneralSettingsPage() {
  const { districtId } = useAuth()
  return (
    <SettingsSectionGate slug="general">
      {districtId && <DistrictSettings key={districtId} districtId={districtId} />}
    </SettingsSectionGate>
  )
}

export function UsersSettingsPage() {
  return (
    <SettingsSectionGate slug="users">
      <UsersSettings />
    </SettingsSectionGate>
  )
}

export function PreferencesSettingsPage() {
  return (
    <SettingsSectionGate slug="preferences">
      <PreferencesSection />
    </SettingsSectionGate>
  )
}

export function DangerSettingsPage() {
  return (
    <SettingsSectionGate slug="danger">
      <DangerZone />
    </SettingsSectionGate>
  )
}
