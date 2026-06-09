import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/app/api/_lib/auth'

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
        .select('id, weight_kg, body_fat_pct, polar_steps, polar_calories_burned, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', since.toISOString())
        .order('logged_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

// POST /api/weight-logs  { userId, weight_kg, body_fat_pct? }
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const { userId, weight_kg, body_fat_pct } = await req.json()
    if (!userId || !weight_kg) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    if (auth.user.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (weight_kg < 20 || weight_kg > 300)
        return NextResponse.json({ error: 'weight_kg must be 20–300' }, { status: 400 })
    if (body_fat_pct != null && (body_fat_pct < 1 || body_fat_pct > 60))
        return NextResponse.json({ error: 'body_fat_pct must be 1–60' }, { status: 400 })

    const payload: Record<string, unknown> = { weight_kg }
    if (body_fat_pct != null) payload.body_fat_pct = body_fat_pct

    // Upsert for today — one entry per day
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabaseAdmin
        .from('weight_logs')
        .select('id')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`)
        .single()

    if (existing) {
        await supabaseAdmin.from('weight_logs').update(payload).eq('id', existing.id)
    } else {
        await supabaseAdmin.from('weight_logs').insert({ user_id: userId, ...payload })
    }

    return NextResponse.json({ ok: true })
}

// DELETE /api/weight-logs?id=<uuid>
export async function DELETE(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // user_id filter ensures a user can only delete their own logs
    const { error } = await supabaseAdmin.from('weight_logs').delete().eq('id', id).eq('user_id', auth.user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}

// PATCH /api/weight-logs?id=<uuid>  — edit a specific log entry
export async function PATCH(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { weight_kg, body_fat_pct } = await req.json()
    if (!weight_kg) return NextResponse.json({ error: 'weight_kg required' }, { status: 400 })
    const payload: Record<string, unknown> = { weight_kg, body_fat_pct: body_fat_pct ?? null }

    // user_id filter ensures a user can only edit their own logs
    const { error } = await supabaseAdmin.from('weight_logs').update(payload).eq('id', id).eq('user_id', auth.user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
