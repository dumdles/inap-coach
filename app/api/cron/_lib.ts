import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

export function guardCron(req: NextRequest) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return null
}

export async function insertNotif(userId: string, type: string, title: string, body: string | null) {
    await supabaseAdmin
        .from('notifications')
        .insert({ user_id: userId, type, title, body: body ?? null, read: false })
}

export function sgTime(date = new Date()) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }))
}
