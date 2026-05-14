// Runs daily at 0700 SGT.
// Sends nutritional cues to users whose ippt_date is exactly 7, 3, or 1 day away.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, guardCron, insertNotif, sgTime } from '../_lib'

export const runtime = 'nodejs'

const CUES: Record<number, string> = {
    7: 'IPPT in 7 days — focus on high protein and adequate carbs this week to peak performance.',
    3: 'IPPT in 3 days — taper training intensity, stay hydrated, and keep meals balanced.',
    1: 'IPPT tomorrow — eat a carb-rich dinner tonight, sleep well, and have a light breakfast.',
}

export async function GET(req: NextRequest) {
    const guard = guardCron(req)
    if (guard) return guard

    const today = sgTime()
    const todayStr = today.toISOString().slice(0, 10)

    const triggerDates = [7, 3, 1].map(days => {
        const d = new Date(today)
        d.setDate(today.getDate() + days)
        return { days, date: d.toISOString().slice(0, 10) }
    })

    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, notif_prefs, ippt_date')
        .not('ippt_date', 'is', null)
        .not('notif_prefs', 'is', null)

    const eligible = (users ?? []).filter(u => u.notif_prefs?.ippt_reminders !== false)

    const inserts: Promise<void>[] = []
    for (const u of eligible) {
        const match = triggerDates.find(t => t.date === u.ippt_date)
        if (!match) continue
        inserts.push(
            insertNotif(
                u.id,
                'ippt_reminder',
                `🏃 IPPT in ${match.days} day${match.days > 1 ? 's' : ''}`,
                CUES[match.days],
            ),
        )
    }

    await Promise.all(inserts)
    return NextResponse.json({ sent: inserts.length })
}
