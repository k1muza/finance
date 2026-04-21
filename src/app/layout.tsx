import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

export const metadata: Metadata = {
  title: 'District Finance Dashboard',
  description: 'Track income, expenditure, and district financial performance',
}

const devServiceWorkerCleanupScript = `
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(function (registrations) {
      return Promise.all(
        registrations.map(function (registration) {
          return registration.unregister()
        })
      )
    })
    .catch(function () {})
}

if ('caches' in window) {
  var cachePrefixes = ['app-shell-', 'supabase-data-', 'image-cache-']
  caches.keys()
    .then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return cachePrefixes.some(function (prefix) {
              return key.startsWith(prefix)
            })
          })
          .map(function (key) {
            return caches.delete(key)
          })
      )
    })
    .catch(function () {})
}
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full overflow-hidden antialiased">
        {process.env.NODE_ENV !== 'production' && (
          <Script id="dev-sw-cleanup" strategy="beforeInteractive">
            {devServiceWorkerCleanupScript}
          </Script>
        )}
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
