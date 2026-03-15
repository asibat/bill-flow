'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Payee } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  utility: 'Utility',
  telecom: 'Telecom',
  tax: 'Tax',
  insurance: 'Insurance',
  rent: 'Rent',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  utility: 'bg-blue-100 text-blue-700',
  telecom: 'bg-purple-100 text-purple-700',
  tax: 'bg-red-100 text-red-700',
  insurance: 'bg-green-100 text-green-700',
  rent: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-700',
}

interface VendorListProps {
  vendors: Payee[]
  billCounts: Record<string, number>
  userId: string
}

export function VendorList({ vendors, billCounts, userId }: VendorListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    iban: '',
    bic: '',
    category: 'other' as string,
  })
  const router = useRouter()

  const userVendors = vendors.filter(v => v.user_id === userId)
  const systemVendors = vendors.filter(v => v.user_id === null)

  function startEdit(vendor: Payee) {
    setEditingId(vendor.id)
    setForm({
      name: vendor.name,
      iban: vendor.iban ?? '',
      bic: vendor.bic ?? '',
      category: vendor.category,
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(vendorId: string) {
    setSaving(true)
    await fetch(`/api/vendors/${vendorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        iban: form.iban || null,
        bic: form.bic || null,
        category: form.category,
      }),
    })
    setSaving(false)
    setEditingId(null)
    router.refresh()
  }

  async function deleteVendor(vendorId: string) {
    if (!confirm('Delete this vendor? Bills linked to it will keep their data.')) return
    setDeleting(vendorId)
    await fetch(`/api/vendors/${vendorId}`, { method: 'DELETE' })
    setDeleting(null)
    router.refresh()
  }

  function renderVendor(vendor: Payee, editable: boolean) {
    const isEditing = editingId === vendor.id
    const count = billCounts[vendor.id] ?? 0

    if (isEditing) {
      return (
        <div key={vendor.id} className="card p-4 border-2 border-brand-200">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">IBAN</label>
                <input
                  className="input font-mono"
                  value={form.iban}
                  onChange={e => setForm({ ...form, iban: e.target.value })}
                  placeholder="BE52 0960 1178 4309"
                />
              </div>
              <div>
                <label className="label">BIC / SWIFT</label>
                <input
                  className="input font-mono"
                  value={form.bic}
                  onChange={e => setForm({ ...form, bic: e.target.value })}
                  placeholder="GKCCBEBB"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => saveEdit(vendor.id)}
                disabled={saving}
                className="btn-primary text-sm"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={cancelEdit} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div key={vendor.id} className="card p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">{vendor.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[vendor.category] ?? CATEGORY_COLORS.other}`}>
              {CATEGORY_LABELS[vendor.category] ?? 'Other'}
            </span>
            {vendor.verified && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Verified</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            {vendor.iban && (
              <p className="text-xs text-gray-500 font-mono">{vendor.iban}</p>
            )}
            {vendor.bic && (
              <p className="text-xs text-gray-400 font-mono">{vendor.bic}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">
            {count} {count === 1 ? 'bill' : 'bills'}
          </p>
        </div>
        {editable && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => startEdit(vendor)}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => deleteVendor(vendor.id)}
              disabled={deleting === vendor.id}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 font-medium"
            >
              {deleting === vendor.id ? '...' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* User's vendors */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Your Vendors ({userVendors.length})
        </h2>
        {userVendors.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-gray-500">
              No vendors yet. Vendors are automatically created when you upload or receive bills.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {userVendors.map(v => renderVendor(v, true))}
          </div>
        )}
      </div>

      {/* System vendors */}
      {systemVendors.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            System Vendors ({systemVendors.length})
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Pre-configured Belgian vendors. These are shared across all users.
          </p>
          <div className="space-y-2">
            {systemVendors.map(v => renderVendor(v, false))}
          </div>
        </div>
      )}
    </div>
  )
}
