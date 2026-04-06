import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
  const offset = (page - 1) * limit

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)
  if (category) {
    // category_user overrides category_ai — filter by effective category
    query = query.or(`category_user.eq.${category},and(category_user.is.null,category_ai.eq.${category})`)
  }
  if (search) query = query.ilike('payee_raw', `%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    transactions: data,
    meta: { total: count ?? 0, page, limit },
  })
}
