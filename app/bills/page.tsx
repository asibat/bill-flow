import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatAmount, formatDueDate, getBillStatusColor, getBillStatusLabel } from '@/lib/utils'
import Link from 'next/link'
import type { Bill } from '@/types'

export default async function BillsPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const status = searchParams.status || 'all'

  let query = supabase
    .from('bills')
    .select('*')
    .eq('user_id', user!.id)
    .order('due_date', { ascending: true })

  if (status !== 'all') query = query.eq('status', status)

  const { data } = await query
  const bills: Bill[] = data || []

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'received', label: 'To Pay' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'payment_sent', label: 'Sent' },
    { key: 'confirmed', label: 'Confirmed' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <Link href="/bills/new" className="btn-primary">+ Add Bill</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/bills?status=${t.key}`}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${status === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {bills.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500">No bills found</p>
          <Link href="/bills/new" className="btn-primary mt-4 inline-flex">Add a bill</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map(bill => (
            <Link key={bill.id} href={`/bills/${bill.id}`}
              className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-lg">
                  {bill.source === 'doccle' ? '🟦' : bill.source === 'email' ? '📧' : bill.source === 'upload' ? '📎' : '✏️'}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{bill.payee_name}</p>
                  <p className="text-xs text-gray-500">{formatDueDate(bill.due_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {bill.structured_comm && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono hidden sm:block ${bill.structured_comm_valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {bill.structured_comm_valid ? '✓' : '⚠'} ref
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBillStatusColor(bill.status)}`}>
                  {getBillStatusLabel(bill.status)}
                </span>
                <span className="font-semibold text-gray-900 text-sm">{formatAmount(bill.amount, bill.currency)}</span>
                <span className="text-gray-400">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
