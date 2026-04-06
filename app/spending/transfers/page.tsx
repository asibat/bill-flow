import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { HouseholdTransferPair } from '@/types'
import TransferReview from '../_components/TransferReview'

export const dynamic = 'force-dynamic'

export default async function TransfersPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: pairs } = await supabase
    .from('household_transfer_pairs')
    .select(`
      *,
      outgoing:transactions!outgoing_transaction_id (
        id, date, amount, currency, payee_raw, account_name, category_ai, category_user
      ),
      incoming:transactions!incoming_transaction_id (
        id, date, amount, currency, payee_raw, account_name, category_ai, category_user
      )
    `)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <a href="/spending" className="text-xs text-gray-400 hover:text-gray-600">← Back to spending</a>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Intra-household Transfers</h1>
          <p className="mt-1 text-sm text-gray-500">
            These transfers were detected between your accounts. Confirm to exclude them from the combined household summary — they represent money moving within the household, not real expenses.
          </p>
        </div>
        <TransferReview pairs={(pairs ?? []) as HouseholdTransferPair[]} />
      </div>
    </div>
  )
}
