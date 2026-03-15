export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">BillFlow</h1>
          <p className="text-brand-200 mt-2 text-sm">Belgian bill management for expats</p>
        </div>
        {children}
      </div>
    </div>
  )
}
