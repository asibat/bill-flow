import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatAmount, formatDueDate, getBillStatusColor, getBillStatusLabel } from '@/lib/utils'
import { aggregateByCurrency } from '@/lib/currency'
import { differenceInDays } from 'date-fns'
import Link from 'next/link'
import type { Bill } from '@/types'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: bills } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', user!.id)
    .order('due_date', { ascending: true })
    .limit(100)

  const allBills: Bill[] = bills || []
  const unpaid = allBills.filter(b => !['confirmed', 'payment_sent'].includes(b.status))
  const overdue = unpaid.filter(b => differenceInDays(new Date(b.due_date), new Date()) < 0)
  const dueThisWeek = unpaid.filter(b => {
    const d = differenceInDays(new Date(b.due_date), new Date())
    return d >= 0 && d <= 7
  })
  const needsReview = allBills.filter(b => b.needs_review)
  const { breakdown: unpaidBreakdown, totalInEur: totalUnpaidEur } = aggregateByCurrency(
    unpaid.map(b => ({ amount: b.amount, currency: b.currency }))
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your Belgian bill overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Outstanding"
          value={unpaidBreakdown.length <= 1 ? formatAmount(totalUnpaidEur) : formatAmount(totalUnpaidEur) + ' equiv.'}
          sub={unpaidBreakdown.length > 1
            ? unpaidBreakdown.map(b => b.formatted).join(' + ')
            : `${unpaid.length} bills`}
          color="blue"
        />
        <StatCard label="Overdue" value={String(overdue.length)} sub={overdue.length ? formatAmount(overdue.reduce((s,b)=>s+b.amount,0)) : 'All good!'} color={overdue.length ? 'red' : 'green'} />
        <StatCard label="Due This Week" value={String(dueThisWeek.length)} sub={dueThisWeek.length ? formatAmount(dueThisWeek.reduce((s,b)=>s+b.amount,0)) : 'Nothing urgent'} color={dueThisWeek.length ? 'amber' : 'green'} />
        <StatCard label="Needs Review" value={String(needsReview.length)} sub="Low confidence extractions" color={needsReview.length ? 'amber' : 'green'} />
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-red-700 mb-3 flex items-center gap-2">
            <span>🔴</span> Overdue
          </h2>
          <div className="space-y-2">
            {overdue.map(bill => <BillRow key={bill.id} bill={bill} />)}
          </div>
        </div>
      )}

      {/* Due this week */}
      {dueThisWeek.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-amber-700 mb-3 flex items-center gap-2">
            <span>🟡</span> Due This Week
          </h2>
          <div className="space-y-2">
            {dueThisWeek.map(bill => <BillRow key={bill.id} bill={bill} />)}
          </div>
        </div>
      )}

      {/* Needs review */}
      {needsReview.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-amber-700 mb-3 flex items-center gap-2">
            <span>⚠️</span> Needs Review
          </h2>
          <div className="space-y-2">
            {needsReview.map(bill => <BillRow key={bill.id} bill={bill} highlight />)}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {unpaid.filter(b => differenceInDays(new Date(b.due_date), new Date()) > 7).length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span>🔵</span> Upcoming
          </h2>
          <div className="space-y-2">
            {unpaid.filter(b => differenceInDays(new Date(b.due_date), new Date()) > 7).map(bill => <BillRow key={bill.id} bill={bill} />)}
          </div>
        </div>
      )}

      {allBills.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h3 className="text-lg font-semibold mb-2">No bills yet</h3>
          <p className="text-gray-500 mb-4 text-sm">Forward a Doccle notification to your inbox address, or add a bill manually.</p>
          <Link href="/bills/new" className="btn-primary">Add your first bill</Link>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-l-brand-500', red: 'border-l-red-500',
    green: 'border-l-green-500', amber: 'border-l-amber-500',
  }
  return (
    <div className={`card p-5 border-l-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  )
}

function BillRow({ bill, highlight }: { bill: Bill; highlight?: boolean }) {
  return (
    <Link href={`/bills/${bill.id}`} className={`card p-4 flex items-center justify-between hover:shadow-md transition-shadow ${highlight ? 'border-amber-300' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-lg">
          {bill.source === 'doccle' ? '🟦' : bill.source === 'email' ? '📧' : bill.source === 'upload' ? '📎' : '✏️'}
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">{bill.payee_name}</p>
          <p className="text-xs text-gray-500">{formatDueDate(bill.due_date)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {bill.structured_comm && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${bill.structured_comm_valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {bill.structured_comm_valid ? '✓ ref' : '⚠ ref'}
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBillStatusColor(bill.status)}`}>
          {getBillStatusLabel(bill.status)}
        </span>
        <span className="font-semibold text-gray-900">{formatAmount(bill.amount, bill.currency)}</span>
        <span className="text-gray-400">›</span>
      </div>
    </Link>
  )
}
