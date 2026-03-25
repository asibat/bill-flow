import type { Metadata } from 'next'
import './globals.css'
import PwaInit from '@/components/pwa/PwaInit'
import { assertProductionEnv } from '@/lib/env'

export const metadata: Metadata = {
  title: 'BillFlow — Belgian Bill Management',
  description: 'Manage your Belgian bills, structured communications, and wire transfers in one place.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BillFlow',
  },
  icons: {
    apple: '/apple-icon',
    icon: ['/icon', '/icon-192.png'],
  },
}

export const viewport = {
  themeColor: '#1d4ed8',
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  assertProductionEnv()

  return (
    <html lang="en">
      <body>
        <PwaInit />
        {children}
      </body>
    </html>
  )
}
