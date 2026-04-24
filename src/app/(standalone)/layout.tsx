import { ToastProvider } from '@/components/ui/Toast'
import { DistrictGuard } from '@/components/layout/DistrictGuard'
import { SyncStatusController } from '@/components/layout/SyncStatusController'

export const dynamic = 'force-dynamic'

export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SyncStatusController />
      <DistrictGuard>
        <div className="h-screen overflow-y-auto bg-slate-950 print:h-auto print:overflow-visible print:bg-white">
          {children}
        </div>
      </DistrictGuard>
    </ToastProvider>
  )
}
