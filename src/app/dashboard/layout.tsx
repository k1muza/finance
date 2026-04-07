import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/ui/Toast'
import { DistrictGuard } from '@/components/layout/DistrictGuard'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DistrictGuard>
        <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-950">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </DistrictGuard>
    </ToastProvider>
  )
}
