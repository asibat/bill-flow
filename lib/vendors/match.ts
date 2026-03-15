import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractionResult } from '@/types'

interface VendorMatch {
  payee_id: string
  payee_name: string
  iban: string | null
  bic: string | null
  category: string
  is_new: boolean
}

/**
 * Match an extraction result to an existing vendor by IBAN,
 * or create a new user vendor if no match found.
 *
 * Uses service-role client to bypass RLS for cross-checking system vendors.
 */
export async function matchOrCreateVendor(
  supabase: SupabaseClient,
  userId: string,
  extraction: ExtractionResult
): Promise<VendorMatch | null> {
  const iban = extraction.iban?.replace(/\s/g, '') || null
  if (!iban) return null

  // Look for existing vendor: user's own first, then system vendors
  const { data: existing } = await supabase
    .from('payees')
    .select('id, name, iban, bic, category, user_id')
    .eq('iban', iban)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('user_id', { ascending: false, nullsFirst: false }) // user's own first
    .limit(1)
    .single()

  if (existing) {
    return {
      payee_id: existing.id,
      payee_name: existing.name,
      iban: existing.iban,
      bic: existing.bic,
      category: existing.category,
      is_new: false,
    }
  }

  // No match — create a new vendor for this user
  const { data: created, error } = await supabase
    .from('payees')
    .insert({
      user_id: userId,
      name: extraction.payee_name || 'Unknown vendor',
      iban,
      bic: extraction.bic || null,
      category: 'other',
      country: 'BE',
      verified: false,
    })
    .select('id, name, iban, bic, category')
    .single()

  if (error || !created) return null

  return {
    payee_id: created.id,
    payee_name: created.name,
    iban: created.iban,
    bic: created.bic,
    category: created.category,
    is_new: true,
  }
}
