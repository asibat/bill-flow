'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CsvUpload from './CsvUpload'
import PayeeEditor from './PayeeEditor'
import CategoryDrillDown from './CategoryDrillDown'
import type { TransactionSummary, SpendingPayee, SpendingCategory, Transaction } from '@/types'

const CategoryChart = dynamic(() => import('./CategoryChart'), { ssr: false })
const MonthlyChart = dynamic(() => import('./MonthlyChart'), { ssr: false })

interface Props {
  summary: TransactionSummary | null
  hasTransactions: boolean
  householdSize: number | null
  monthlyIncome: number | null
  incomeCurrency: string
  payeeMetadata: SpendingPayee[]
  transactions: Transaction[]
  allAccountNames: string[]
  activeAccount: string
  activeDateFrom: string | null
  defaultDateFrom: string | null
  pendingTransferCount: number
  confirmedTransferCount: number
}

function fmt(n: number) {
  return `€${n.toLocaleString('en-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-brand-200 bg-gradient-to-br from-brand-50 to-white',
    red: 'border-red-200 bg-gradient-to-br from-red-50 to-white',
    green: 'border-green-200 bg-gradient-to-br from-green-50 to-white',
    amber: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
    slate: 'border-slate-200 bg-gradient-to-br from-slate-50 to-white',
  }
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colors[color] ?? colors.blue}`}>
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-[0.18em]">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2 tracking-tight">{value}</p>
      <p className="text-xs text-gray-500 mt-2 min-h-[2rem]">{sub}</p>
    </div>
  )
}

export default function SpendingDashboard({
  summary,
  hasTransactions,
  householdSize,
  monthlyIncome,
  incomeCurrency,
  payeeMetadata,
  transactions,
  allAccountNames,
  activeAccount,
  activeDateFrom,
  defaultDateFrom,
  pendingTransferCount,
  confirmedTransferCount,
}: Props) {
  const router = useRouter()
  const [metadataMap, setMetadataMap] = useState<Record<string, SpendingPayee>>(
    Object.fromEntries(payeeMetadata.map(p => [p.payee_raw, p]))
  )
  const [drillCategory, setDrillCategory] = useState<SpendingCategory | null>(null)
  const [savingDefault, setSavingDefault] = useState(false)
  const [dateInput, setDateInput] = useState(activeDateFrom ?? '')

  const monthCount = summary?.byMonth.length ?? 1
  const avgMonthlyExpense = summary ? summary.totalExpenses / monthCount : null
  const perPerson = avgMonthlyExpense && householdSize ? avgMonthlyExpense / householdSize : null
  const avgMonthlyCostOfLiving = summary ? summary.costOfLiving / monthCount : null

  function navigate(params: Record<string, string | null>) {
    const url = new URL('/spending', window.location.origin)
    if (activeAccount !== 'all') url.searchParams.set('account', activeAccount)
    if (activeDateFrom) url.searchParams.set('from', activeDateFrom)
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === 'all') url.searchParams.delete(k)
      else url.searchParams.set(k, v)
    }
    router.push(url.pathname + url.search)
  }

  async function saveDefaultDate() {
    if (!dateInput) return
    setSavingDefault(true)
    await fetch('/api/spending/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spending_date_from: dateInput || null }),
    })
    setSavingDefault(false)
    navigate({ from: dateInput || null })
  }

  return (
    <div className="px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Header */}
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
          <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Spending Analysis
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Where is the money going?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Import your N26 bank statement CSV to get an AI-powered breakdown of your household spending by category.
          </p>
        </section>

        {/* Upload */}
        <CsvUpload />

        {/* Filters — only when data exists */}
        {hasTransactions && (
          <div className="card p-4 flex flex-wrap items-end gap-4">
            {/* Account pills */}
            {allAccountNames.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Account</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => navigate({ account: null })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeAccount === 'all' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-gray-600 hover:bg-slate-200'}`}
                  >
                    All accounts
                  </button>
                  {allAccountNames.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => navigate({ account: name })}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeAccount === name ? 'bg-brand-600 text-white' : 'bg-slate-100 text-gray-600 hover:bg-slate-200'}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date filter */}
            <div>
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">From date</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => navigate({ from: dateInput || null })}
                  className="text-xs rounded-lg bg-slate-100 px-2.5 py-1 text-gray-600 hover:bg-slate-200"
                >
                  Apply
                </button>
                {dateInput !== (defaultDateFrom ?? '') && (
                  <button
                    type="button"
                    onClick={saveDefaultDate}
                    disabled={savingDefault}
                    className="text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
                  >
                    {savingDefault ? 'Saving…' : 'Save as default'}
                  </button>
                )}
                {activeDateFrom && (
                  <button
                    type="button"
                    onClick={() => { setDateInput(''); navigate({ from: null }) }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Intra-household transfer banner — all accounts view only */}
        {activeAccount === 'all' && pendingTransferCount > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{pendingTransferCount} intra-household transfer{pendingTransferCount !== 1 ? 's' : ''} detected</span>
              {' '}— review them to exclude double-counted amounts from the household summary.
            </p>
            <a
              href="/spending/transfers"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Review
            </a>
          </div>
        )}

        {/* Stats */}
        {summary && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <StatCard
                label="Cost of Living"
                value={avgMonthlyCostOfLiving ? fmt(avgMonthlyCostOfLiving) : '—'}
                sub={`avg/month · excl. transfers${householdSize && householdSize > 1 ? ` · ${fmt((avgMonthlyCostOfLiving ?? 0) / householdSize)}/person` : ''}${confirmedTransferCount > 0 && activeAccount === 'all' ? ` · excl. ${confirmedTransferCount} intra-household` : ''}`}
                color="blue"
              />
              <StatCard
                label="Total Expenses"
                value={fmt(summary.totalExpenses)}
                sub={`across ${monthCount} month${monthCount !== 1 ? 's' : ''}${perPerson ? ` · ${fmt(perPerson)}/person` : ''}`}
                color="blue"
              />
              <StatCard
                label="Total Income"
                value={fmt(summary.totalIncome)}
                sub={`${monthCount} months · ${fmt(summary.totalIncome / monthCount)}/month avg`}
                color="green"
              />
              <StatCard
                label="Savings Rate"
                value={summary.savingsRate !== null ? `${summary.savingsRate}%` : '—'}
                sub={summary.savingsRate !== null
                  ? `${fmt(summary.costOfLiving / monthCount)}/mo cost · ${fmt((summary.totalIncome - summary.costOfLiving) / monthCount)}/mo saved`
                  : 'No income data'
                }
                color={summary.savingsRate !== null ? (summary.savingsRate >= 20 ? 'green' : summary.savingsRate >= 10 ? 'amber' : 'red') : 'slate'}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Category breakdown */}
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">By Category</h2>
                <p className="text-sm text-gray-500 mb-4">Click a category to drill in and annotate.</p>
                <CategoryChart byCategory={summary.byCategory} />
                <div className="mt-4 space-y-1">
                  {summary.byCategory.map(c => (
                    <button
                      key={c.category}
                      type="button"
                      onClick={() => setDrillCategory(c.category)}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-slate-50 transition-colors group"
                    >
                      <span className="capitalize text-gray-700 group-hover:text-brand-600">{c.category}</span>
                      <span className="text-right flex items-center gap-1">
                        {c.offsets > 0 ? (
                          <span className="flex flex-col items-end">
                            <span className="text-gray-900 font-medium">{fmt(c.net)} net</span>
                            <span className="text-[10px] text-gray-400">
                              {fmt(c.gross)} gross · -{fmt(c.offsets)} offset
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-500">
                            {fmt(c.gross)}
                            <span className="text-gray-400 text-xs ml-1">({c.percentage}%)</span>
                          </span>
                        )}
                        <span className="ml-1 text-gray-300 group-hover:text-brand-400">›</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Monthly trend */}
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Monthly Trend</h2>
                <p className="text-sm text-gray-500 mb-4">Income vs. expenses over time.</p>
                <MonthlyChart byMonth={summary.byMonth} />
              </div>
            </div>

            {/* Top payees */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Top Payees</h2>
              <p className="text-sm text-gray-500 mb-4">Click any payee to add a label, category override, or notes.</p>
              <div className="space-y-2">
                {summary.topPayees.map((p, i) => (
                  <div key={p.payee} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <PayeeEditor
                        payeeRaw={p.payee}
                        total={p.total}
                        count={p.count}
                        metadata={metadataMap[p.payee] ?? null}
                        onSaved={saved => setMetadataMap(prev => ({ ...prev, [saved.payee_raw]: saved }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!hasTransactions && (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">💸</div>
            <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
            <p className="text-gray-500 text-sm">Upload a CSV export from your N26 account above to get started.</p>
          </div>
        )}
      </div>

      {drillCategory && (
        <CategoryDrillDown
          category={drillCategory}
          transactions={transactions}
          metadataMap={metadataMap}
          onClose={() => setDrillCategory(null)}
          onPayeeSaved={saved => setMetadataMap(prev => ({ ...prev, [saved.payee_raw]: saved }))}
          onReanalyzed={() => setDrillCategory(null)}
        />
      )}
    </div>
  )
}
