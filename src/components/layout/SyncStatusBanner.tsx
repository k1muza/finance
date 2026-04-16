'use client'

import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'
import { useAppUiStore } from '@/stores/app-ui-store'

export function SyncStatusBanner() {
  const syncStatus = useAppUiStore((state) => state.syncStatus)

  if (syncStatus.networkStatus === 'offline') {
    return (
      <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-300" />
          <span className="font-medium">Offline mode</span>
          <span className="text-amber-200/80">
            Live validation and posting actions will be limited until the connection returns.
          </span>
        </div>
      </div>
    )
  }

  if (syncStatus.syncPhase === 'failed') {
    return (
      <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-100">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" />
          <span className="font-medium">Sync needs attention</span>
          <span className="text-red-200/80">
            {syncStatus.lastError ?? `Unable to sync ${syncStatus.failedCount} queued change(s).`}
          </span>
        </div>
      </div>
    )
  }

  if (syncStatus.syncPhase === 'syncing') {
    return (
      <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm text-cyan-100">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-cyan-300" />
          <span className="font-medium">Syncing changes</span>
          <span className="text-cyan-200/80">
            {syncStatus.pendingCount > 0
              ? `${syncStatus.pendingCount} queued change(s) are being replayed.`
              : 'Queued changes are being replayed.'}
          </span>
        </div>
      </div>
    )
  }

  return null
}
