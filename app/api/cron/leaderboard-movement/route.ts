// Runs daily at 0800 SGT after scores are computed.
// Notifies users who moved ≥3 ranks vs the previous week.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, guardCron, insertNotif, sgTime } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
    const guard = guardCron(req)
    if (guard) return guard

    const now = sgTime()

    // Current week start (Sunday)
    const currentWeekStart = new Date(now)
    currentWeekStart.setDate(now.getDate() - now.getDay())
    currentWeekStart.setHours(0, 0, 0, 0)

    // Previous week start
    const prevWeekStart = new Date(currentWeekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)

    const { data: currentScores } = await supabaseAdmin
        .from('leaderboard_scores')
        .select('user_id, total_score, wing')
        .eq('week_start', currentWeekStart.toISOString().slice(0, 10))

    const { data: prevScores } = await supabaseAdmin
        .from('leaderboard_scores')
        .select('user_id, total_score, wing')
        .eq('week_start', prevWeekStart.toISOString().slice(0, 10))

    if (!currentScores?.length || !prevScores?.length) return NextResponse.json({ sent: 0 })

    type ScoreRow = { user_id: string; total_score: number; wing: string | null }

    // Rank within wing — higher score = lower rank number
    function rankWithinWing(scores: ScoreRow[]) {
        const byWing = new Map<string, ScoreRow[]>()
        for (const s of scores) {
            const wing = s.wing ?? 'none'
            const arr = byWing.get(wing) ?? []
            arr.push(s)
            byWing.set(wing, arr)
        }
        const rankMap = new Map<string, number>()
        for (const [, members] of byWing) {
            members.sort((a, b) => b.total_score - a.total_score)
            members.forEach((m, i) => rankMap.set(m.user_id, i + 1))
        }
        return rankMap
    }

    const currentRanks = rankWithinWing(currentScores as ScoreRow[])
    const prevRanks = rankWithinWing(prevScores as ScoreRow[])

    // Users who opted into leaderboard notifications
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, notif_prefs')
        .not('notif_prefs', 'is', null)

    const optin = new Set(
        (users ?? [])
            .filter(u => u.notif_prefs?.leaderboard === true)
            .map(u => u.id),
    )

    const inserts: Promise<void>[] = []
    for (const [userId, currentRank] of currentRanks) {
        if (!optin.has(userId)) continue
        const prevRank = prevRanks.get(userId)
        if (prevRank == null) continue
        const delta = prevRank - currentRank // positive = moved up
        if (Math.abs(delta) < 3) continue
        const moved = delta > 0 ? `up ${delta}` : `down ${Math.abs(delta)}`
        const emoji = delta > 0 ? '📈' : '📉'
        inserts.push(
            insertNotif(
                userId,
                'leaderboard_movement',
                `${emoji} You moved ${moved} on the leaderboard`,
                `You're now ranked #${currentRank} in your wing.`,
            ),
        )
    }

    await Promise.all(inserts)
    return NextResponse.json({ sent: inserts.length })
}
