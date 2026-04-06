'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { TransactionSummary } from '@/types'

const CATEGORY_COLORS: Record<string, string> = {
  housing: '#1d4ed8',
  utilities: '#7c3aed',
  groceries: '#059669',
  transport: '#d97706',
  health: '#dc2626',
  dining: '#ea580c',
  subscriptions: '#0891b2',
  shopping: '#db2777',
  cash: '#92400e',
  income: '#16a34a',
  transfer: '#64748b',
  other: '#94a3b8',
}

interface Props {
  byCategory: TransactionSummary['byCategory']
}

export default function CategoryChart({ byCategory }: Props) {
  const data = byCategory.filter(c => c.gross > 0)

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No expense data</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="gross"
          nameKey="category"
        >
          {data.map((entry) => (
            <Cell
              key={entry.category}
              fill={CATEGORY_COLORS[entry.category as string] ?? '#94a3b8'}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => {
            const n = typeof value === 'number' ? value : 0
            return `€${n.toLocaleString('en-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }}
          labelFormatter={(label) => {
            const s = String(label ?? '')
            return s.charAt(0).toUpperCase() + s.slice(1)
          }}
        />
        <Legend
          formatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
