import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/weight-logs?userId=<uuid>&days=90
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const userId = searchParams.get('userId')
    const days = parseInt(searchParams.get('days') ?? '90')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabaseAdmin
        .from('weight_logs')
        .select('id, weight_kg, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', since.toISOString())
        .order('logged_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

// POST /api/weight-logs  { userId, weight_kg }
export async function POST(req: NextRequest) {
    const { userId, weight_kg } = await req.json()
    if (!userId || !weight_kg) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

    // Upsert for today (one entry per day)
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabaseAdmin
        .from('weight_logs')
        .select('id')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`)
        .single()

    if (existing) {
        await supabaseAdmin.from('weight_logs').update({ weight_kg }).eq('id', existing.id)
    } else {
        await supabaseAdmin.from('weight_logs').insert({ user_id: userId, weight_kg })
    }

    return NextResponse.json({ ok: true })
}
