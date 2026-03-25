'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validateStructuredComm, formatStructuredComm } from '@/lib/utils'
import { BillFormFields } from '@/components/bills/BillFormFields'
import type { BillFormData } from '@/types'

interface ManualFormProps {
  onBack: () => void
}

export function ManualForm({ onBack }: ManualFormProps) {
  const [form, setForm] = useState<BillFormData>({})
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const structured = form.structured_comm ? formatStructuredComm(form.structured_comm as string) : null
    await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payee_name: form.payee_name,
        amount: parseFloat(form.amount as string),
        currency: 'EUR',
        due_date: form.due_date,
        structured_comm: structured,
        structured_comm_valid: structured ? validateStructuredComm(structured) : null,
        iban: form.iban || null,
        bic: form.bic || null,
        notes: form.notes || null,
        source: 'manual',
      }),
    })
    router.refresh()
    router.replace('/dashboard')
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-brand-600 hover:underline">&larr; Back</button>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Manual Entry</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Add the transfer details yourself.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Use this when you already know the payment details or want to enter a bill without uploading a file.
          </p>
        </div>
      </div>
      <BillFormFields form={form} setForm={setForm} required />
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Bill'}
        </button>
        <button type="button" onClick={onBack} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
