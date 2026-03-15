import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BillFlow — Belgian Bill Management',
  description: 'Manage your Belgian bills, structured communications, and wire transfers in one place.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
