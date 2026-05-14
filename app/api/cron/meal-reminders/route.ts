// Runs 3× daily at 1100, 1500, 1900 SGT.
// Notifies users who haven't logged a meal in the 4-hour window before each check.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, guardCron, insertNotif, sgTime } from '../_lib'

export const runtime = 'nodejs'

const WINDOWS: Array<{ hour: number; label: string; message: string }> = [
    { hour: 11, label: 'breakfast', message: "Don't forget to log your morning meal!" },
    { hour: 15, label: 'lunch',     message: "Lunch logged? Keep your streak going." },
    { hour: 19, label: 'dinner',    message: "Log your dinner to complete today's record." },
]

export async function GET(req: NextRequest) {
    const guard = guardCron(req)
    if (guard) return guard

    const now = sgTime()
    const currentHour = now.getHours()
    const window = WINDOWS.find(w => w.hour === currentHour)
    if (!window) return NextResponse.json({ skipped: true, hour: currentHour })

    const windowStart = new Date(now)
    windowStart.setHours(window.hour - 4, 0, 0, 0)

    // Users who opted into meal reminders
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, notif_prefs')
        .not('notif_prefs', 'is', null)

    const eligible = (users ?? []).filter(u => u.notif_prefs?.meal_reminders !== false)

    // Find who already logged in this window
    const { data: logs } = await supabaseAdmin
        .from('meal_logs')
        .select('user_id')
        .gte('logged_at', windowStart.toISOString())
        .lte('logged_at', now.toISOString())

    const logged = new Set((logs ?? []).map(l => l.user_id))

    const inserts = eligible
        .filter(u => !logged.has(u.id))
        .map(u => insertNotif(u.id, 'meal_reminder', '🍽 Time to log your meal', window.message))

    await Promise.all(inserts)
    return NextResponse.json({ sent: inserts.length })
}
