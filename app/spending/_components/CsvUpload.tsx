'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'spending_account_names'
const MAX_SAVED = 5

interface ImportResult {
  imported: number
  total: number
  skippedDuplicates: number
  duplicates: Array<{ date: string; amount: number; payee: string }>
  parseErrors: Array<{ row: number; message: string }>
  autoOffsets: Array<{ payee_raw: string; offsets_category: string }>
  accountName: string | null
}

export default function CsvUpload() {
  const router = useRouter()
  const [accountName, setAccountName] = useState('')
  const [pastAccounts, setPastAccounts] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setPastAccounts(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  function saveAccountName(name: string) {
    if (!name) return
    const updated = [name, ...pastAccounts.filter(a => a !== name)].slice(0, MAX_SAVED)
    setPastAccounts(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return

    setStatus('uploading')
    setResult(null)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('account_name', accountName.trim())

    try {
      const res = await fetch('/api/spending/import', { method: 'POST', body: formData })
      const json = await res.json()

      if (!res.ok) {
        setStatus('error')
        setErrorMsg(json.error ?? 'Import failed')
        return
      }

      saveAccountName(accountName.trim())
      setResult(json)
      setStatus('done')
      router.refresh()
    } catch {
      setStatus('error')
      setErrorMsg('Network error — please try again')
    }
  }, [router, accountName, pastAccounts])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    disabled: status === 'uploading' || !accountName.trim(),
  })

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Import N26 Statement</h2>
        <p className="mt-1 text-sm text-gray-500">Upload a CSV export from your N26 account. Transactions will be AI-categorized automatically.</p>
      </div>

      {/* Account name input */}
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1">Account name</label>
        <input
          list="past-accounts"
          type="text"
          value={accountName}
          onChange={e => setAccountName(e.target.value)}
          placeholder="e.g. Amir - N26, Nevena - N26"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
        />
        <datalist id="past-accounts">
          {pastAccounts.map(a => <option key={a} value={a} />)}
        </datalist>
        {!accountName.trim() && (
          <p className="text-[11px] text-amber-500 mt-1">Enter an account name to enable upload</p>
        )}
      </div>

      <div
        {...getRootProps()}
        className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          !accountName.trim()
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
            : isDragActive
              ? 'border-brand-400 bg-brand-50 cursor-pointer'
              : status === 'uploading'
                ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/40 cursor-pointer'
        }`}
      >
        <input {...getInputProps()} />
        {status === 'uploading' ? (
          <div className="space-y-2">
            <div className="text-2xl animate-pulse">⚙️</div>
            <p className="text-sm font-medium text-gray-600">Parsing and categorizing with AI…</p>
            <p className="text-xs text-gray-400">This may take a few seconds</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-3xl">📂</div>
            <p className="text-sm font-medium text-gray-700">
              {isDragActive ? 'Drop your CSV here' : 'Drag & drop your N26 CSV, or click to select'}
            </p>
            <p className="text-xs text-gray-400">Export from N26 app → Accounts → Export as CSV</p>
          </div>
        )}
      </div>

      {status === 'done' && result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-green-800">
            Import complete — {result.imported} new transaction{result.imported !== 1 ? 's' : ''} added
            {result.accountName && <span className="font-normal"> to <span className="font-semibold">{result.accountName}</span></span>}
          </p>
          {result.autoOffsets?.length > 0 && (
            <details open>
              <summary className="text-xs text-brand-600 cursor-pointer font-medium">
                {result.autoOffsets.length} recurring income pattern{result.autoOffsets.length !== 1 ? 's' : ''} auto-configured
              </summary>
              <ul className="mt-1.5 space-y-1">
                {result.autoOffsets.map((o, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="text-green-500">✓</span>
                    <span className="font-mono">{o.payee_raw}</span>
                    <span className="text-gray-400">→ offsets</span>
                    <span className="capitalize font-medium text-brand-600">{o.offsets_category}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.skippedDuplicates > 0 && (
            <details>
              <summary className="text-xs text-amber-600 cursor-pointer">
                {result.skippedDuplicates} duplicate{result.skippedDuplicates !== 1 ? 's' : ''} skipped (already in database)
              </summary>
              <div className="mt-2 rounded-lg border border-amber-200 bg-white overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-amber-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-amber-700 font-medium">Date</th>
                      <th className="px-3 py-1.5 text-left text-amber-700 font-medium">Payee</th>
                      <th className="px-3 py-1.5 text-right text-amber-700 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {result.duplicates.map((d, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-gray-500">{d.date}</td>
                        <td className="px-3 py-1.5 text-gray-700">{d.payee}</td>
                        <td className="px-3 py-1.5 text-right text-gray-700">€{Math.abs(d.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          {result.parseErrors.length > 0 && (
            <details>
              <summary className="text-xs text-amber-600 cursor-pointer">{result.parseErrors.length} row{result.parseErrors.length !== 1 ? 's' : ''} had parse warnings</summary>
              <ul className="mt-1 space-y-0.5">
                {result.parseErrors.map((e, i) => (
                  <li key={i} className="text-xs text-amber-700">Row {e.row}: {e.message}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Import failed</p>
          <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
        </div>
      )}
    </div>
  )
}
