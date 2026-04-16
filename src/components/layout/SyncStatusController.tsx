'use client'

import { useEffect } from 'react'
import { useAppUiStore } from '@/stores/app-ui-store'

export function SyncStatusController() {
  const setNetworkStatus = useAppUiStore((state) => state.setNetworkStatus)

  useEffect(() => {
    setNetworkStatus(window.navigator.onLine ? 'online' : 'offline')

    const handleOnline = () => setNetworkStatus('online')
    const handleOffline = () => setNetworkStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setNetworkStatus])

  return null
}
