'use client'

import { useState } from 'react'
import { ModeCard } from '@/components/bills/ModeCard'
import { UploadForm } from './UploadForm'
import { ManualForm } from './ManualForm'
import type { PrivacyLevel } from '@/types'

type Mode = 'choose' | 'upload' | 'manual'

interface Props {
  defaultPrivacyLevel: PrivacyLevel
}

export function NewBillClient({ defaultPrivacyLevel }: Props) {
  const [mode, setMode] = useState<Mode>('choose')

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Bill</h1>

      {mode === 'choose' && (
        <div className="grid grid-cols-2 gap-4">
          <ModeCard
            icon="📎"
            title="Upload PDF or Screenshot"
            desc="Upload a bill PDF or screenshot — AI extracts the details automatically"
            onClick={() => setMode('upload')}
          />
          <ModeCard
            icon="✏️"
            title="Enter Manually"
            desc="Type in the bill details yourself"
            onClick={() => setMode('manual')}
          />
          <div className="col-span-2 card p-5 bg-brand-50 border-brand-200">
            <p className="text-sm font-semibold text-brand-700 mb-1">📧 Forward by Email (Recommended for Doccle)</p>
            <p className="text-sm text-brand-600">
              The easiest way: forward any Doccle notification or bill email directly to your personal inbox address shown in the sidebar. BillFlow handles everything automatically.
            </p>
          </div>
        </div>
      )}

      {mode === 'upload' && <UploadForm onBack={() => setMode('choose')} defaultPrivacyLevel={defaultPrivacyLevel} />}
      {mode === 'manual' && <ManualForm onBack={() => setMode('choose')} />}
    </div>
  )
}
