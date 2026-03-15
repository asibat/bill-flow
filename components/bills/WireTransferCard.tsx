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
  return (
    <div className="border-2 border-brand-600 rounded-xl overflow-hidden">
      <div className="bg-brand-700 px-5 py-3 flex items-center justify-between">
        <span className="text-white font-semibold text-sm">Wire Transfer Instructions</span>
        <span className="text-brand-200 text-xs">Copy each field into your bank app</span>
      </div>
      <div className="p-5 space-y-3 bg-white">
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
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            <span className="font-medium text-red-600">Pay before:</span>{' '}
            {new Date(dueDate).toLocaleDateString('en-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {structuredComm && (
            <p className="text-xs text-gray-500 mt-1">
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
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(copyValue || value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
      <div className="flex items-center gap-2">
        <div className={`flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm select-all ${mono ? 'font-mono' : 'font-medium'}`}>
          {value}
        </div>
        <button
          onClick={copy}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
