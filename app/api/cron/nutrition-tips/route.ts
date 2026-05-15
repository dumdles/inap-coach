// Runs daily at 0700 SGT.
// Sends one random active nutrition tip to users who opted in.
// Avoids repeating the same tip within 30 days.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, guardCron, insertNotif, sgTime } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
    const guard = guardCron(req)
    if (guard) return guard

    const { data: tips } = await supabaseAdmin
        .from('nutrition_tips')
        .select('id, title, content')
        .eq('is_active', true)

    if (!tips?.length) return NextResponse.json({ sent: 0, reason: 'no active tips' })

    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, notif_prefs')
        .not('notif_prefs', 'is', null)

    const eligible = (users ?? []).filter(u => u.notif_prefs?.tips === true)
    if (!eligible.length) return NextResponse.json({ sent: 0 })

    // Find tips sent in the last 30 days per user to avoid repeats
    const thirtyDaysAgo = new Date(sgTime())
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentNotifs } = await supabaseAdmin
        .from('notifications')
        .select('user_id, body')
        .eq('type', 'nutrition_tip')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .in('user_id', eligible.map(u => u.id))

    // Map userId → set of recently seen tip titles (using body prefix as proxy)
    const recentByUser = new Map<string, Set<string>>()
    for (const n of recentNotifs ?? []) {
        const s = recentByUser.get(n.user_id) ?? new Set()
        s.add(n.body ?? '')
        recentByUser.set(n.user_id, s)
    }

    function pickTip(userId: string) {
        const seen = recentByUser.get(userId) ?? new Set()
        const unseen = tips!.filter(t => !seen.has(t.content))
        const pool = unseen.length > 0 ? unseen : tips!
        return pool[Math.floor(Math.random() * pool.length)]
    }

    const inserts = eligible.map(u => {
        const tip = pickTip(u.id)
        return insertNotif(u.id, 'nutrition_tip', `💡 ${tip.title}`, tip.content)
    })

    await Promise.all(inserts)
    return NextResponse.json({ sent: inserts.length })
}
