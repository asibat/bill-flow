'use client'

import { useState } from 'react'
import NavLink from '@/components/layout/NavLink'
import SignOutButton from '@/components/layout/SignOutButton'
import InstallPrompt from '@/components/pwa/InstallPrompt'

interface AppShellProps {
  children: React.ReactNode
  userEmail: string
  inboxAddress?: string | null
}

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', match: 'exact' as const },
  { href: '/bills', label: 'Bills', icon: '📄', match: 'section' as const },
  { href: '/vendors', label: 'Vendors', icon: '🏢', match: 'section' as const },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️', match: 'exact' as const },
]

const actionNav = [
  { href: '/bills/new', label: 'Add Bill', icon: '➕', match: 'exact' as const },
  { href: '/bills/batch', label: 'Payment Session', icon: '💳', match: 'exact' as const },
]

const mobileNav = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', match: 'exact' as const },
  { href: '/bills', label: 'Bills', icon: '📄', match: 'section' as const },
  { href: '/bills/new', label: 'Add', icon: '➕', match: 'exact' as const },
  { href: '/bills/batch', label: 'Pay', icon: '💳', match: 'exact' as const },
]

export default function AppShell({ children, userEmail, inboxAddress }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.08),_transparent_35%),linear-gradient(to_bottom,_#f8fafc,_#f3f4f6)]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">BillFlow</p>
            <p className="text-xs text-slate-500">Bills, reminders, and payments</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(open => !open)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            {mobileMenuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4">
            <nav className="space-y-2">
              {primaryNav.map(item => (
                <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="menu" match={item.match} onClick={() => setMobileMenuOpen(false)} />
              ))}
            </nav>
            <div className="mt-4 rounded-2xl border border-slate-200 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Quick actions</p>
              <nav className="space-y-2">
                {actionNav.map(item => (
                  <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="menu" match={item.match} onClick={() => setMobileMenuOpen(false)} />
                ))}
              </nav>
            </div>
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              {inboxAddress && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">Your bill inbox</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-800">{inboxAddress}</p>
                </div>
              )}
              <InstallPrompt />
              <div className="flex items-center justify-between">
                <span className="max-w-[70%] truncate text-xs text-slate-500">{userEmail}</span>
                <SignOutButton />
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-brand-900/10 bg-brand-700/95 text-white md:flex md:flex-col md:sticky md:top-0 md:h-screen">
          <div className="px-6 py-6 border-b border-brand-600/80">
            <span className="text-2xl font-bold tracking-tight">BillFlow</span>
            <p className="mt-1 text-sm text-brand-100">Belgian bill management that stays actionable.</p>
          </div>
          <nav className="flex-1 px-4 py-5 space-y-1.5">
            {primaryNav.map(item => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="sidebar" match={item.match} />
            ))}
          </nav>
          <div className="px-4 pb-5">
            <div className="rounded-2xl bg-brand-800/70 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-200">Quick actions</p>
              <div className="space-y-1.5">
                {actionNav.map(item => (
                  <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="sidebar" match={item.match} />
                ))}
              </div>
            </div>
          </div>
          <div className="px-4 py-4 border-t border-brand-600/80 space-y-3">
            {inboxAddress && (
              <div className="rounded-xl bg-brand-800/90 p-3">
                <p className="text-xs font-medium text-brand-200">Your bill inbox</p>
                <p className="mt-1 break-all font-mono text-xs text-white">{inboxAddress}</p>
                <p className="mt-2 text-xs text-brand-300">Forward Doccle and other bill emails here.</p>
              </div>
            )}
            <InstallPrompt />
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-xs text-brand-200">{userEmail}</span>
              <SignOutButton />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 md:pb-0">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
            {mobileNav.map(item => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="mobile" match={item.match} onClick={() => setMobileMenuOpen(false)} />
          ))}
        </div>
      </nav>
    </div>
  )
}
