import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/ippt-results?userId=<uuid>
export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
        .from('ippt_results')
        .select('*')
        .eq('user_id', userId)
        .order('test_date', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

// POST /api/ippt-results
// Body: { userId, test_date, pushup_reps?, situp_reps?, run_time_seconds?,
//         pushup_points?, situp_points?, run_points?, total_points, award?, notes? }
export async function POST(req: NextRequest) {
    const body = await req.json()
    const { userId, test_date, pushup_reps, situp_reps, run_time_seconds,
            pushup_points, situp_points, run_points, total_points, award, notes } = body

    if (!userId || !test_date || total_points == null)
        return NextResponse.json({ error: 'userId, test_date, and total_points are required' }, { status: 400 })

    if (typeof total_points !== 'number' || total_points < 0 || total_points > 150)
        return NextResponse.json({ error: 'total_points must be 0–150' }, { status: 400 })

    const { data, error } = await supabaseAdmin
        .from('ippt_results')
        .insert({
            user_id: userId,
            test_date,
            pushup_reps:      pushup_reps      ?? null,
            situp_reps:       situp_reps       ?? null,
            run_time_seconds: run_time_seconds ?? null,
            pushup_points:    pushup_points    ?? null,
            situp_points:     situp_points     ?? null,
            run_points:       run_points       ?? null,
            total_points,
            award:  award  ?? null,
            notes:  notes  ?? null,
        })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
