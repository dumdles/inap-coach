import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { requireRole } from '@/app/api/_lib/roles'
import { buildRace, canManageChallenge, canSeeChallenge, computeChallenge, finalizeIfDue, loadParticipants, myStanding } from '@/app/api/_lib/challenges'
import { isSuperadmin } from '@/lib/roles'
import { LIVE_EDITABLE, challengeStatus, validateChallenge, type Challenge, type ChallengeInput } from '@/lib/challenges'

// GET /api/challenges/[id] — challenge + live (or final) standings, the caller's
// position, race-chart series and (reps challenges) the exercises counted
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

        const me = auth.requester.id
        const mine = myStanding(c, computed, me)

        // Points actually paid out (finished challenges)
        const { data: awards } = c.finalized_at
            ? await supabaseAdmin.from('challenge_awards').select('user_id, points, place').eq('challenge_id', c.id)
            : { data: [] }

        // Exercises a reps challenge counts (names for the header + quick log).
        const { data: exercises } = c.metric === 'reps' && c.exercise_ids?.length
            ? await supabaseAdmin.from('exercise_templates').select('id, name').in('id', c.exercise_ids)
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
            race: buildRace(c, computed, me),
            exercises: exercises ?? [],
            awardedCount: (awards ?? []).length,
            canManage: canManageChallenge(auth.requester, c) && !c.finalized_at,
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}

// PATCH /api/challenges/[id] — edit. Creator or superadmin, before it ends.
// Upcoming: any field. Live: only title, description, end time and bonus (see
// LIVE_EDITABLE in lib/challenges.ts) — other fields in the body are ignored.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(req, ['instructor', 'superadmin'])
    if (auth.error) return auth.error
    const r = auth.requester
    const { id } = await params

    const { data } = await supabaseAdmin.from('challenges').select('*').eq('id', id).maybeSingle()
    const c = data as Challenge | null
    if (!c || !canManageChallenge(r, c)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const status = challengeStatus(c)
    if (c.finalized_at || status === 'ended') return NextResponse.json({ error: 'Finished challenges can’t be edited' }, { status: 409 })

    const body = (await req.json().catch(() => ({}))) as Partial<ChallengeInput>
    const current: ChallengeInput = {
        title: c.title, description: c.description, metric: c.metric, exercise_ids: c.exercise_ids,
        format: c.format, team_level: c.team_level, scope_wing: c.scope_wing, scope_platoon: c.scope_platoon,
        starts_at: c.starts_at, ends_at: c.ends_at, bonus_points: c.bonus_points,
    }
    const allowed = status === 'live' ? LIVE_EDITABLE : (Object.keys(current) as (keyof ChallengeInput)[])
    const next: ChallengeInput = { ...current }
    for (const k of allowed) if (k in body) (next as Record<string, unknown>)[k] = body[k]
    if (status === 'upcoming') {
        // Same scope rules as creating: instructors stay in their own wing.
        next.scope_wing = isSuperadmin(r.role) ? (next.scope_wing || null) : r.wing
        next.scope_platoon = next.scope_platoon || null
    }
    next.bonus_points = Number(next.bonus_points ?? 0)

    const errors = validateChallenge(next, Date.now(), c)
    if (Object.keys(errors).length)
        return NextResponse.json({ error: Object.values(errors)[0], fields: errors }, { status: 400 })

    const exercise_ids = next.metric === 'reps' ? [...new Set(next.exercise_ids ?? [])] : null
    if (exercise_ids && status === 'upcoming') {
        const { data: found } = await supabaseAdmin.from('exercise_templates').select('id').in('id', exercise_ids)
        if ((found ?? []).length !== exercise_ids.length)
            return NextResponse.json({ error: 'Unknown exercise', fields: { exercise_ids: 'Unknown exercise' } }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
        .from('challenges')
        .update({
            title: next.title.trim(),
            description: next.description?.trim() || null,
            metric: next.metric, exercise_ids,
            format: next.format, team_level: next.format === 'team' ? next.team_level : null,
            scope_wing: next.scope_wing, scope_platoon: next.scope_platoon,
            starts_at: new Date(next.starts_at).toISOString(),
            ends_at: new Date(next.ends_at).toISOString(),
            bonus_points: next.bonus_points,
        })
        .eq('id', id)
        .is('finalized_at', null)
        .select('*')
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Let participants know if the deadline or the prize changed.
    const u = updated as Challenge
    const changes = [
        Date.parse(u.ends_at) !== Date.parse(c.ends_at) && `now ends ${new Date(u.ends_at).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore' })}`,
        u.bonus_points !== c.bonus_points && `bonus is now ${u.bonus_points} pts`,
    ].filter(Boolean)
    if (changes.length) {
        const participants = await loadParticipants(u).catch(() => [])
        const notifs = participants.map(p => ({ user_id: p.id, type: 'challenge', read: false, title: `Challenge updated: ${u.title}`, body: changes.join(' · ') }))
        for (let i = 0; i < notifs.length; i += 500) await supabaseAdmin.from('notifications').insert(notifs.slice(i, i + 500))
    }
    return NextResponse.json(u)
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
