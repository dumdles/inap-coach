// Runs every hour. Checks each user's preferred recap day+time and fires once per week.
// notif_prefs.weekly_recap_day: 0–6 (Sun–Sat), default 0
// notif_prefs.weekly_recap_time: "HH:00" 24h, default "18:00"
// Deduplication: skips if a weekly_recap notification already exists this week.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, guardCron, insertNotif, sgTime } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
    const guard = guardCron(req)
    if (guard) return guard

    const now = sgTime()
    const currentDay = now.getDay()
    const currentHour = now.getHours()

    // Week start (Sunday) for dedup check
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - currentDay)
    weekStart.setHours(0, 0, 0, 0)

    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, notif_prefs')
        .not('notif_prefs', 'is', null)

    const eligible = (users ?? []).filter(u => {
        if (u.notif_prefs?.weekly_summary === false) return false
        const day = u.notif_prefs?.weekly_recap_day ?? 0
        const hour = parseInt((u.notif_prefs?.weekly_recap_time ?? '18:00').split(':')[0], 10)
        return day === currentDay && hour === currentHour
    })

    if (!eligible.length) return NextResponse.json({ sent: 0 })

    // Dedup: find who already got one this week
    const { data: existing } = await supabaseAdmin
        .from('notifications')
        .select('user_id')
        .eq('type', 'weekly_recap')
        .gte('created_at', weekStart.toISOString())
        .in('user_id', eligible.map(u => u.id))

    const alreadySent = new Set((existing ?? []).map(n => n.user_id))

    // Pull this week's summary stats for each user
    const userIds = eligible.filter(u => !alreadySent.has(u.id)).map(u => u.id)
    if (!userIds.length) return NextResponse.json({ sent: 0 })

    const { data: summaries } = await supabaseAdmin
        .from('daily_summaries')
        .select('user_id, total_calories, total_protein_g, calorie_target')
        .gte('date', weekStart.toISOString().slice(0, 10))
        .in('user_id', userIds)

    const { data: scores } = await supabaseAdmin
        .from('leaderboard_scores')
        .select('user_id, total_score')
        .gte('week_start', weekStart.toISOString().slice(0, 10))
        .in('user_id', userIds)

    const scoreMap = new Map((scores ?? []).map(s => [s.user_id, s.total_score]))

    // Group summaries by user
    const summaryByUser = new Map<string, typeof summaries>()
    for (const s of summaries ?? []) {
        const arr = summaryByUser.get(s.user_id) ?? []
        arr.push(s)
        summaryByUser.set(s.user_id, arr)
    }

    const inserts = userIds.map(userId => {
        const days = summaryByUser.get(userId) ?? []
        const daysLogged = days.length
        const avgCal = daysLogged
            ? Math.round(days.reduce((a, d) => a + (d.total_calories ?? 0), 0) / daysLogged)
            : 0
        const avgProtein = daysLogged
            ? Math.round(days.reduce((a, d) => a + (d.total_protein_g ?? 0), 0) / daysLogged)
            : 0
        const score = scoreMap.get(userId)
        const scoreStr = score != null ? ` · Score: ${score}` : ''
        return insertNotif(
            userId,
            'weekly_recap',
            '📊 Your weekly performance recap',
            `${daysLogged}/7 days logged · Avg ${avgCal} kcal · Avg protein ${avgProtein}g${scoreStr}`,
        )
    })

    await Promise.all(inserts)
    return NextResponse.json({ sent: inserts.length })
}
