import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/ui/Toast'
import { DistrictGuard } from '@/components/layout/DistrictGuard'
import { SyncStatusBanner } from '@/components/layout/SyncStatusBanner'
import { SyncStatusController } from '@/components/layout/SyncStatusController'
import { CanonicalDistrictRedirect } from '@/components/layout/CanonicalDistrictRedirect'
import { SidebarStateProvider } from '@/components/layout/SidebarState'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <CanonicalDistrictRedirect>
      <ToastProvider>
        <SyncStatusController />
        <DistrictGuard>
          <SidebarStateProvider>
            <div data-dashboard-shell className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-950">
              <div className="print-hidden contents md:block">
                <Sidebar />
              </div>
              <div data-dashboard-content className="flex flex-col flex-1 overflow-hidden">
                <TopBar />
                <SyncStatusBanner />
                <main className="flex-1 overflow-y-auto">
                  {children}
                </main>
              </div>
            </div>
          </SidebarStateProvider>
        </DistrictGuard>
      </ToastProvider>
    </CanonicalDistrictRedirect>
  )
}
