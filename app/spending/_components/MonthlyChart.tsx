'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { TransactionSummary } from '@/types'

interface Props {
  byMonth: TransactionSummary['byMonth']
}

export default function MonthlyChart({ byMonth }: Props) {
  if (byMonth.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No monthly data</p>
  }

  const formatter = (value: unknown) => {
    const n = typeof value === 'number' ? value : 0
    return `€${n.toLocaleString('en-BE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={formatter} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
        <Tooltip formatter={formatter} />
        <Legend iconType="circle" iconSize={8} />
        <Bar dataKey="expenses" name="Expenses" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
