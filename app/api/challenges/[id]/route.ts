import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { requireRole } from '@/app/api/_lib/roles'
import { canManageChallenge, canSeeChallenge, computeChallenge, finalizeIfDue } from '@/app/api/_lib/challenges'
import { teamKey, type Challenge } from '@/lib/challenges'

// GET /api/challenges/[id] — challenge + live (or final) standings + the caller's position
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(req)
    if (auth.error) return auth.error
    const { id } = await params

    const { data } = await supabaseAdmin.from('challenges').select('*').eq('id', id).maybeSingle()
    let c = data as Challenge | null
    if (!c || !canSeeChallenge(auth.requester, c)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    try {
        const computed = await computeChallenge(c)
        c = await finalizeIfDue(c, computed)

        // Where does the caller stand? (null for staff who aren't competing)
        const me = auth.requester.id
        let mine: { score: number; place: number; of: number; team?: { label: string; place: number; score: number } } | null = null
        const myScore = computed.scores.get(me)
        if (myScore != null) {
            const st = computed.standings
            if (st.format === 'individual') {
                const row = st.rows.find(r => r.id === me)!
                mine = { score: myScore, place: row.place, of: st.rows.length }
            } else {
                const p = computed.participants.find(x => x.id === me)!
                const key = teamKey(c.team_level!, p)?.key
                const t = st.rows.find(r => r.key === key)
                mine = { score: myScore, place: 0, of: 0, team: t ? { label: t.label, place: t.place, score: t.score } : undefined }
            }
        }

        // Points actually paid out (finished challenges)
        const { data: awards } = c.finalized_at
            ? await supabaseAdmin.from('challenge_awards').select('user_id, points, place').eq('challenge_id', c.id)
            : { data: [] }

        // Team rows carry member ids for scoring; the client only needs counts.
        const standings = computed.standings.format === 'team'
            ? { format: 'team' as const, rows: computed.standings.rows.map(({ memberIds, ...t }) => ({ ...t, isMine: memberIds.includes(me) })) }
            : computed.standings

        return NextResponse.json({
            challenge: c,
            standings,
            participants: computed.participants.length,
            mine,
            myAward: (awards ?? []).find(a => a.user_id === me) ?? null,
            awardedCount: (awards ?? []).length,
            canManage: canManageChallenge(auth.requester, c) && !c.finalized_at,
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}

// DELETE /api/challenges/[id] — cancel. Creator or superadmin, and only before it's paid out.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(req, ['instructor', 'superadmin'])
    if (auth.error) return auth.error
    const { id } = await params

    const { data } = await supabaseAdmin.from('challenges').select('*').eq('id', id).maybeSingle()
    const c = data as Challenge | null
    if (!c || !canManageChallenge(auth.requester, c)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (c.finalized_at) return NextResponse.json({ error: 'Finished challenges cannot be cancelled' }, { status: 409 })

    const { error } = await supabaseAdmin.from('challenges').delete().eq('id', id).is('finalized_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
