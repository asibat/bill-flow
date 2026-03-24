import NavLink from '@/components/layout/NavLink'
import SignOutButton from '@/components/layout/SignOutButton'
import InstallPrompt from '@/components/pwa/InstallPrompt'

interface AppShellProps {
  children: React.ReactNode
  userEmail: string
  inboxAddress?: string | null
}

export default function AppShell({ children, userEmail, inboxAddress }: AppShellProps) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-brand-700 text-white flex flex-col fixed inset-y-0 left-0 z-10">
        <div className="px-6 py-5 border-b border-brand-600">
          <span className="text-xl font-bold tracking-tight">BillFlow</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink href="/dashboard" label="Dashboard" icon="📊" />
          <NavLink href="/bills" label="All Bills" icon="📄" />
          <NavLink href="/bills/new" label="Add Bill" icon="➕" />
          <NavLink href="/bills/batch" label="Pay Batch" icon="💳" />
          <NavLink href="/vendors" label="Vendors" icon="🏢" />
          <NavLink href="/dashboard/settings" label="Settings" icon="⚙️" />
        </nav>
        <div className="px-4 py-4 border-t border-brand-600 space-y-3">
          {inboxAddress && (
            <div className="bg-brand-800 rounded-lg p-3">
              <p className="text-xs text-brand-300 font-medium mb-1">Your bill inbox</p>
              <p className="text-xs text-white font-mono break-all">{inboxAddress}</p>
              <p className="text-xs text-brand-400 mt-1">Forward Doccle notifications here</p>
            </div>
          )}
          <InstallPrompt />
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-300 truncate">{userEmail}</span>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
