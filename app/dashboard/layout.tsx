import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/layout/SignOutButton'
import NavLink from '@/components/layout/NavLink'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase
    .from('user_settings')
    .select('email_inbox_address, onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (settings && !settings.onboarding_completed) redirect('/onboarding')

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-700 text-white flex flex-col fixed inset-y-0 left-0 z-10">
        <div className="px-6 py-5 border-b border-brand-600">
          <span className="text-xl font-bold tracking-tight">BillFlow</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink href="/dashboard" label="Dashboard" icon="📊" />
          <NavLink href="/bills" label="All Bills" icon="📄" />
          <NavLink href="/bills/new" label="Add Bill" icon="➕" />
          <NavLink href="/vendors" label="Vendors" icon="🏢" />
          <NavLink href="/dashboard/settings" label="Settings" icon="⚙️" />
        </nav>
        <div className="px-4 py-4 border-t border-brand-600 space-y-3">
          {settings?.email_inbox_address && (
            <div className="bg-brand-800 rounded-lg p-3">
              <p className="text-xs text-brand-300 font-medium mb-1">Your bill inbox</p>
              <p className="text-xs text-white font-mono break-all">{settings.email_inbox_address}</p>
              <p className="text-xs text-brand-400 mt-1">Forward Doccle notifications here</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-300 truncate">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </aside>
      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
