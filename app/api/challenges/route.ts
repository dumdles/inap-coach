import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { requireRole } from '@/app/api/_lib/roles'
import { canSeeChallenge, computeChallenge, finalizeAllDue, loadParticipants, myStanding, topRows } from '@/app/api/_lib/challenges'
import { isSuperadmin } from '@/lib/roles'
import { challengeStatus, validateChallenge, scopeLabel, type Challenge, type ChallengeInput } from '@/lib/challenges'

const LIVE_SUMMARY_LIMIT = 6

// GET /api/challenges — challenges the caller can see (live, upcoming, recent finished)
export async function GET(req: NextRequest) {
    const auth = await requireRole(req)
    if (auth.error) return auth.error

    // Pay out anything that ended since the last visit (cheap no-op normally).
    await finalizeAllDue().catch(e => console.error('[challenges] finalizeAllDue', e))

    const since = new Date(Date.now() - 60 * 86400_000).toISOString() // finished ones: last 60 days
    const { data, error } = await supabaseAdmin
        .from('challenges')
        .select('*')
        .gte('ends_at', since)
        .order('starts_at', { ascending: false })
        .limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const visible = ((data ?? []) as Challenge[]).filter(c => canSeeChallenge(auth.requester, c))
    const me = auth.requester.id

    // Live cards show your place, the leader and the top 3 — compute standings for
    // the live challenges ending soonest (capped; each one reads its window's logs),
    // in parallel with the caller's trophy cabinet (all bonus points ever won).
    const live = visible.filter(c => challengeStatus(c) === 'live')
        .sort((a, b) => Date.parse(a.ends_at) - Date.parse(b.ends_at)).slice(0, LIVE_SUMMARY_LIMIT)
    const [summaries, awardsRes] = await Promise.all([
        Promise.all(live.map(async c => {
            try {
                const computed = await computeChallenge(c)
                return [c.id, { participants: computed.participants.length, mine: myStanding(c, computed, me), top: topRows(computed) }] as const
            } catch (e) {
                console.error('[challenges] summary failed', c.id, e)
                return null
            }
        })),
        supabaseAdmin.from('challenge_awards').select('challenge_id, points, place').eq('user_id', me)
            .order('awarded_at', { ascending: false }).limit(1000),
    ])
    const awards = awardsRes.data ?? []

    return NextResponse.json({
        challenges: visible,
        summaries: Object.fromEntries(summaries.filter(x => x !== null)),
        trophies: {
            total: awards.length,
            points: awards.reduce((a, w) => a + w.points, 0),
            byPlace: [1, 2, 3].map(p => awards.filter(w => w.place === p).length),
            // challenge id → what the caller won there (for the medal on finished cards)
            won: Object.fromEntries(awards.map(w => [w.challenge_id, { place: w.place, points: w.points }])),
        },
        canCreate: auth.requester.role !== 'cadet',
        // Instructors may only target their own wing; the create dialog locks it.
        myWing: auth.requester.wing,
        isSuperadmin: isSuperadmin(auth.requester.role),
    })
}

// POST /api/challenges — create (verified instructors: own wing; superadmins: any wing or all)
export async function POST(req: NextRequest) {
    const auth = await requireRole(req, ['instructor', 'superadmin'])
    if (auth.error) return auth.error
    const r = auth.requester

    const body = (await req.json().catch(() => ({}))) as Partial<ChallengeInput>
    // Instructors can't target other wings or "all wings" — force their own.
    const scope_wing = isSuperadmin(r.role) ? (body.scope_wing || null) : r.wing
    if (!isSuperadmin(r.role) && !scope_wing)
        return NextResponse.json({ error: 'Your profile has no wing set' }, { status: 400 })
    const input = { ...body, scope_wing, scope_platoon: body.scope_platoon || null, bonus_points: Number(body.bonus_points ?? 0) }

    const errors = validateChallenge(input)
    if (Object.keys(errors).length)
        return NextResponse.json({ error: Object.values(errors)[0], fields: errors }, { status: 400 })

    // Reps challenges: every exercise must be a real exercise template.
    const exercise_ids = input.metric === 'reps' ? [...new Set(input.exercise_ids ?? [])] : null
    if (exercise_ids) {
        const { data: found } = await supabaseAdmin.from('exercise_templates').select('id').in('id', exercise_ids)
        if ((found ?? []).length !== exercise_ids.length)
            return NextResponse.json({ error: 'Unknown exercise', fields: { exercise_ids: 'Unknown exercise' } }, { status: 400 })
    }

    const { data: created, error } = await supabaseAdmin
        .from('challenges')
        .insert({
            title: input.title!.trim(),
            description: input.description?.trim() || null,
            metric: input.metric,
            exercise_ids,
            format: input.format,
            team_level: input.format === 'team' ? input.team_level : null,
            scope_wing: input.scope_wing,
            scope_platoon: input.scope_platoon,
            starts_at: new Date(input.starts_at!).toISOString(),
            ends_at: new Date(input.ends_at!).toISOString(),
            bonus_points: input.bonus_points,
            created_by: r.id,
        })
        .select('*')
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Let every enrolled cadet know (batched).
    const c = created as Challenge
    const participants = await loadParticipants(c).catch(() => [])
    const notifs = participants.map(p => ({
        user_id: p.id, type: 'challenge', read: false,
        title: `New challenge: ${c.title}`,
        body: `${scopeLabel(c)}${c.bonus_points ? ` · ${c.bonus_points} bonus pts for the winner` : ''}`,
    }))
    for (let i = 0; i < notifs.length; i += 500) await supabaseAdmin.from('notifications').insert(notifs.slice(i, i + 500))

    return NextResponse.json(c, { status: 201 })
}
