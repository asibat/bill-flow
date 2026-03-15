import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Payee } from '@/types'
import { VendorList } from './_components/VendorList'

export default async function VendorsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: vendors } = await supabase
    .from('payees')
    .select('*')
    .order('name', { ascending: true })

  // Count bills per vendor
  const { data: billCounts } = await supabase
    .from('bills')
    .select('payee_id')
    .eq('user_id', user!.id)
    .not('payee_id', 'is', null)

  const countMap: Record<string, number> = {}
  for (const b of billCounts ?? []) {
    if (b.payee_id) {
      countMap[b.payee_id] = (countMap[b.payee_id] || 0) + 1
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vendors are auto-created when bills are extracted. You can edit or manage them here.
          </p>
        </div>
      </div>

      <VendorList
        vendors={(vendors ?? []) as Payee[]}
        billCounts={countMap}
        userId={user!.id}
      />
    </div>
  )
}
