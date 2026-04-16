'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { APP_THEMES } from '@/components/layout/themeCatalog'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      themes={[...APP_THEMES]}
    >
      {children}
    </NextThemesProvider>
  )
}
