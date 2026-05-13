import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/users/search?q=<name>&excludeId=<uuid>
export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get('q') ?? ''
    const excludeId = req.nextUrl.searchParams.get('excludeId') ?? ''

    if (q.trim().length < 2) return NextResponse.json([])

    let query = supabaseAdmin
        .from('users')
        .select('id, full_name, rank, wing')
        .ilike('full_name', `%${q.trim()}%`)
        .limit(8)

    if (excludeId) query = query.neq('id', excludeId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}
