import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatAmount, formatDueDate, getBillStatusColor, getBillStatusLabel } from '@/lib/utils'
import { aggregateByCurrency } from '@/lib/currency'
import { getMonthlySpending, getTopVendors, getSpendingTrend } from '@/lib/analytics'
import { isFeatureEnabled } from '@/lib/features'
import { getVisibleReminders } from '@/lib/reminders/view'
import { differenceInDays, format } from 'date-fns'
import Link from 'next/link'
import type { Bill } from '@/types'
import RemindersList from './_components/RemindersList'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: bills } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', user!.id)
    .order('due_date', { ascending: true })
    .limit(200)

  // Fetch upcoming reminders
  const { data: reminders } = await supabase
    .from('reminders')
    .select('id, bill_id, remind_at, kind, sent_at, dismissed_at, bills!inner(payee_name, amount, currency, due_date, paid_at, status)')
    .eq('user_id', user!.id)
    .is('dismissed_at', null)
    .order('remind_at', { ascending: true })
    .limit(10)

  const visibleReminders = getVisibleReminders(reminders ?? [])

  // Fetch salary day for countdown
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('salary_day')
    .eq('user_id', user!.id)
    .single()

  const allBills: Bill[] = bills || []
  const unpaid = allBills.filter(b => !['confirmed', 'payment_sent'].includes(b.status))
  const paid = allBills.filter(b => ['confirmed', 'payment_sent'].includes(b.status))
  const overdue = unpaid.filter(b => differenceInDays(new Date(b.due_date), new Date()) < 0)
  const dueThisWeek = unpaid.filter(b => {
    const d = differenceInDays(new Date(b.due_date), new Date())
    return d >= 0 && d <= 7
  })
  const needsReview = allBills.filter(b => b.needs_review)
  const { breakdown: unpaidBreakdown, totalInEur: totalUnpaidEur } = aggregateByCurrency(
    unpaid.map(b => ({ amount: b.amount, currency: b.currency }))
  )

  // Analytics (feature-flagged)
  const showAnalytics = isFeatureEnabled('DASHBOARD_ANALYTICS')
  const monthlySpending = showAnalytics ? getMonthlySpending(allBills, 6) : []
  const topVendors = showAnalytics ? getTopVendors(allBills, 5) : []
  const trend = showAnalytics ? getSpendingTrend(monthlySpending) : null
  const totalPaid = paid.reduce((s, b) => s + b.amount, 0)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your Belgian bill overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
        <StatCard
          label="Paid"
          value={String(paid.length)}
          sub={paid.length ? formatAmount(totalPaid) : 'No payments yet'}
          color="green"
        />
      </div>

      {/* Reminders & Salary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Upcoming reminders */}
        <div className="md:col-span-2">
          <RemindersList reminders={visibleReminders} />
        </div>

        {/* Salary countdown + split view */}
        {userSettings?.salary_day && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Next Payday</h2>
            <SalaryCountdown salaryDay={userSettings.salary_day} totalDue={totalUnpaidEur} />
            <SalarySplit salaryDay={userSettings.salary_day} bills={unpaid} />
          </div>
        )}
      </div>

      {/* Spending trend */}
      {trend && (
        <div className="card p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Monthly Spending</h2>
          <div className="flex items-end gap-2 h-32 mb-4">
            {monthlySpending.map(m => {
              const maxTotal = Math.max(...monthlySpending.map(ms => ms.total), 1)
              const height = m.total > 0 ? Math.max((m.total / maxTotal) * 100, 4) : 4
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{m.total > 0 ? formatAmount(m.total) : ''}</span>
                  <div
                    className="w-full rounded-t bg-brand-400 transition-all"
                    style={{ height: `${height}%`, minHeight: '2px' }}
                  />
                  <span className="text-xs text-gray-400">{m.label.split(' ')[0]}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {trend.direction === 'up' && <span className="text-red-600 font-medium">+{trend.percentageChange}% vs last month</span>}
            {trend.direction === 'down' && <span className="text-green-600 font-medium">-{trend.percentageChange}% vs last month</span>}
            {trend.direction === 'stable' && <span className="text-gray-500">Stable vs last month</span>}
          </div>
        </div>
      )}

      {/* Top vendors */}
      {topVendors.length > 0 && (
        <div className="card p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Top Vendors</h2>
          <div className="space-y-3">
            {topVendors.map(v => (
              <div key={v.payee_name} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate">{v.payee_name}</span>
                  <span className="text-xs text-gray-400">{v.count} bills</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-400 rounded-full" style={{ width: `${v.percentage}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-24 text-right">{formatAmount(v.total, v.currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-6">
          <SectionHeader label="Overdue" color="red" />
          <div className="space-y-2">
            {overdue.map(bill => <BillRow key={bill.id} bill={bill} />)}
          </div>
        </div>
      )}

      {/* Due this week */}
      {dueThisWeek.length > 0 && (
        <div className="mb-6">
          <SectionHeader label="Due This Week" color="amber" />
          <div className="space-y-2">
            {dueThisWeek.map(bill => <BillRow key={bill.id} bill={bill} />)}
          </div>
        </div>
      )}

      {/* Needs review */}
      {needsReview.length > 0 && (
        <div className="mb-6">
          <SectionHeader label="Needs Review" color="amber" />
          <div className="space-y-2">
            {needsReview.map(bill => <BillRow key={bill.id} bill={bill} highlight />)}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {unpaid.filter(b => differenceInDays(new Date(b.due_date), new Date()) > 7).length > 0 && (
        <div className="mb-6">
          <SectionHeader label="Upcoming" color="blue" />
          <div className="space-y-2">
            {unpaid.filter(b => differenceInDays(new Date(b.due_date), new Date()) > 7).map(bill => <BillRow key={bill.id} bill={bill} />)}
          </div>
        </div>
      )}

      {/* Recently Paid */}
      {paid.length > 0 && (
        <div className="mb-6">
          <SectionHeader label="Recently Paid" color="green" />
          <div className="space-y-2">
            {paid.slice(0, 5).map(bill => <BillRow key={bill.id} bill={bill} />)}
            {paid.length > 5 && (
              <Link href="/bills?status=paid" className="block text-sm text-brand-600 hover:underline pl-1 pt-1">
                View all {paid.length} paid bills
              </Link>
            )}
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

function SectionHeader({ label, color }: { label: string; color: string }) {
  const dots: Record<string, string> = { red: 'text-red-500', amber: 'text-amber-500', blue: 'text-brand-500', green: 'text-green-500' }
  const textColors: Record<string, string> = { red: 'text-red-700', amber: 'text-amber-700', blue: 'text-gray-700', green: 'text-green-700' }
  return (
    <h2 className={`text-base font-semibold ${textColors[color] || 'text-gray-700'} mb-3 flex items-center gap-2`}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full bg-current ${dots[color]}`} />
      {label}
    </h2>
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

function SalaryCountdown({ salaryDay, totalDue }: { salaryDay: number; totalDue: number }) {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), salaryDay)
  const nextPayday = thisMonth > today ? thisMonth : new Date(today.getFullYear(), today.getMonth() + 1, salaryDay)
  const daysUntil = differenceInDays(nextPayday, today)

  return (
    <div className="text-center">
      <p className="text-4xl font-bold text-brand-600">{daysUntil}</p>
      <p className="text-sm text-gray-500 mt-1">day{daysUntil !== 1 ? 's' : ''} until payday</p>
      <p className="text-xs text-gray-400 mt-1">{format(nextPayday, 'd MMMM')}</p>
      {totalDue > 0 && (
        <p className="text-xs text-gray-500 mt-3">
          {formatAmount(totalDue)} due before then
        </p>
      )}
    </div>
  )
}

function SalarySplit({ salaryDay, bills }: { salaryDay: number; bills: Bill[] }) {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), salaryDay)
  const nextPayday = thisMonth > today ? thisMonth : new Date(today.getFullYear(), today.getMonth() + 1, salaryDay)

  const beforePayday = bills.filter(b => new Date(b.due_date) < nextPayday)
  const afterPayday = bills.filter(b => new Date(b.due_date) >= nextPayday)
  const beforeTotal = beforePayday.reduce((s, b) => s + b.amount, 0)
  const afterTotal = afterPayday.reduce((s, b) => s + b.amount, 0)

  if (bills.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      {beforePayday.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-red-600">Pay before salary</span>
            <span className="text-gray-500">{formatAmount(beforeTotal)}</span>
          </div>
          <div className="space-y-1">
            {beforePayday.slice(0, 4).map(b => (
              <Link key={b.id} href={`/bills/${b.id}`} className="flex justify-between text-xs text-gray-600 hover:text-gray-900">
                <span className="truncate">{b.payee_name}</span>
                <span className="shrink-0 ml-2">{formatAmount(b.amount)}</span>
              </Link>
            ))}
            {beforePayday.length > 4 && (
              <span className="text-xs text-gray-400">+{beforePayday.length - 4} more</span>
            )}
          </div>
        </div>
      )}
      {afterPayday.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-green-600">After salary lands</span>
            <span className="text-gray-500">{formatAmount(afterTotal)}</span>
          </div>
          <div className="space-y-1">
            {afterPayday.slice(0, 3).map(b => (
              <Link key={b.id} href={`/bills/${b.id}`} className="flex justify-between text-xs text-gray-600 hover:text-gray-900">
                <span className="truncate">{b.payee_name}</span>
                <span className="shrink-0 ml-2">{formatAmount(b.amount)}</span>
              </Link>
            ))}
            {afterPayday.length > 3 && (
              <span className="text-xs text-gray-400">+{afterPayday.length - 3} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BillRow({ bill, highlight }: { bill: Bill; highlight?: boolean }) {
  const isPaid = ['payment_sent', 'confirmed'].includes(bill.status)
  return (
    <Link href={`/bills/${bill.id}`} className={`card p-4 flex items-center justify-between hover:shadow-md transition-shadow ${highlight ? 'border-amber-300' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${isPaid ? 'bg-green-50' : 'bg-brand-50'}`}>
          {bill.source === 'doccle' ? '🟦' : bill.source === 'email' ? '📧' : bill.source === 'upload' ? '📎' : '✏️'}
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">{bill.payee_name}</p>
          <p className="text-xs text-gray-500">
            {isPaid && bill.paid_at
              ? `Paid ${format(new Date(bill.paid_at), 'd MMM yyyy')}`
              : formatDueDate(bill.due_date)}
          </p>
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
        <span className={`font-semibold ${isPaid ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{formatAmount(bill.amount, bill.currency)}</span>
        <span className="text-gray-400">›</span>
      </div>
    </Link>
  )
}
