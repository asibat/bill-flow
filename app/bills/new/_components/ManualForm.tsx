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
    router.push('/dashboard')
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-brand-600 hover:underline">&larr; Back</button>
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
