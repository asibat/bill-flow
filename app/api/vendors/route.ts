import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateVendorSchema = z.object({
  name: z.string().min(1),
  iban: z.string().optional().nullable(),
  bic: z.string().optional().nullable(),
  category: z.enum(['utility', 'telecom', 'tax', 'insurance', 'rent', 'other']).default('other'),
  country: z.string().default('BE'),
})

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Returns both system vendors and user's own vendors (RLS handles filtering)
  const { data, error } = await supabase
    .from('payees')
    .select('*')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ vendors: data })
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateVendorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Normalize IBAN: remove spaces
  const iban = parsed.data.iban?.replace(/\s/g, '') || null

  // Check for duplicate IBAN among user's vendors
  if (iban) {
    const { data: existing } = await supabase
      .from('payees')
      .select('id, name')
      .eq('iban', iban)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `Vendor with this IBAN already exists: ${existing.name}` },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabase
    .from('payees')
    .insert({
      ...parsed.data,
      iban,
      user_id: user.id,
      verified: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ vendor: data }, { status: 201 })
}
