'use client'
import { useState } from 'react'
import { formatIBAN } from '@/lib/utils'

interface Props {
  beneficiary: string
  iban: string
  bic: string
  amount: number
  currency: string
  structuredComm: string
  dueDate: string
  structuredCommValid: boolean | null
}

export default function WireTransferCard({ beneficiary, iban, bic, amount, currency, structuredComm, dueDate, structuredCommValid }: Props) {
  const combinedCopyValue = [
    `Beneficiary: ${beneficiary}`,
    iban ? `IBAN: ${iban.replace(/\s/g, '')}` : null,
    bic ? `BIC: ${bic}` : null,
    `Amount: ${amount.toFixed(2)} ${currency}`,
    structuredComm ? `Structured communication: ${structuredComm}` : null,
    `Due date: ${new Date(dueDate).toLocaleDateString('en-BE', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  ].filter(Boolean).join('\n')

  return (
    <div className="overflow-hidden rounded-[24px] border-2 border-brand-600 bg-white shadow-sm">
      <div className="bg-brand-700 px-4 py-4 md:px-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-white font-semibold text-sm">Wire Transfer Instructions</span>
          <p className="mt-1 text-brand-200 text-xs">Copy these fields into your bank app exactly as shown.</p>
        </div>
        <div className="flex items-center gap-3">
          <CopyButton value={combinedCopyValue} compact />
        </div>
      </div>
      <div className="p-4 space-y-3 bg-white md:p-5">
        <CopyField label="Beneficiary" value={beneficiary} />
        {iban && <CopyField label="IBAN" value={formatIBAN(iban)} copyValue={iban.replace(/\s/g, '')} mono />}
        {bic && <CopyField label="BIC / SWIFT" value={bic} mono />}
        <CopyField label="Amount" value={`${amount.toFixed(2)} ${currency}`} copyValue={amount.toFixed(2)} />
        {structuredComm && (
          <CopyField
            label="Structured Communication"
            value={structuredComm}
            mono
            badge={structuredCommValid === true ? { text: '✓ Valid', color: 'green' } : structuredCommValid === false ? { text: '⚠ Verify', color: 'red' } : undefined}
          />
        )}
        <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200">
          <p className="text-xs text-gray-600">
            <span className="font-medium text-red-600">Pay before:</span>{' '}
            {new Date(dueDate).toLocaleDateString('en-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {structuredComm && (
            <p className="text-xs text-gray-500 mt-2 leading-5">
              ⚠️ The structured communication is mandatory. An incorrect reference may cause your payment to bounce.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function CopyField({
  label, value, copyValue, mono, badge
}: {
  label: string; value: string; copyValue?: string; mono?: boolean; badge?: { text: string; color: string }
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color === 'green' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className={`flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm select-all ${mono ? 'font-mono' : 'font-medium'}`}>
          {value}
        </div>
        <CopyButton value={copyValue || value} />
      </div>
    </div>
  )
}

function CopyButton({ value, compact = false }: { value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className={`${compact ? 'px-3 py-2 bg-white/10 text-white hover:bg-white/20' : 'w-full sm:w-auto px-3 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100'} rounded-lg text-xs font-medium transition-all`}
    >
      {copied ? '✓ Copied' : compact ? 'Copy all' : 'Copy'}
    </button>
  )
}
