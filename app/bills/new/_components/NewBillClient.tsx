'use client'

import { useState } from 'react'
import { ModeCard } from '@/components/bills/ModeCard'
import { UploadForm } from './UploadForm'
import { ManualForm } from './ManualForm'

type Mode = 'choose' | 'upload' | 'manual'

export function NewBillClient() {
  const [mode, setMode] = useState<Mode>('choose')

  return (
    <div className="px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              Add Bill
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Choose the fastest way to capture a bill.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
              Upload a document for extraction, type the details manually, or forward the email straight into your BillFlow inbox.
            </p>
          </div>
        </div>

        {mode === 'choose' && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <ModeCard
                icon="📎"
                title="Upload PDF or Screenshot"
                desc="Best when you already have the bill file or a screenshot. BillFlow extracts the transfer details and sends you to review."
                onClick={() => setMode('upload')}
              />
              <ModeCard
                icon="✏️"
                title="Enter Manually"
                desc="Best for quick one-off bills when you just want to type the payee, amount, due date, and transfer reference."
                onClick={() => setMode('manual')}
              />
            </div>

            <div className="rounded-[24px] border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-brand-700">📧 Forward by Email</p>
              <p className="mt-3 text-sm leading-6 text-brand-900">
                Forward Doccle notifications and other bill emails directly to your personal BillFlow inbox. That is still the fastest path when the bill is already in your email.
              </p>
              <div className="mt-5 rounded-2xl bg-white/80 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Recommended when:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>Doccle sent you the invoice notice</li>
                  <li>The supplier email already includes the PDF</li>
                  <li>You want BillFlow to process it without opening the app first</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {mode === 'upload' && <UploadForm onBack={() => setMode('choose')} />}
        {mode === 'manual' && <ManualForm onBack={() => setMode('choose')} />}
      </div>
    </div>
  )
}
