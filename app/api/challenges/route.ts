import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { requireRole } from '@/app/api/_lib/roles'
import { canSeeChallenge, finalizeAllDue, loadParticipants } from '@/app/api/_lib/challenges'
import { isSuperadmin } from '@/lib/roles'
import { validateChallenge, scopeLabel, type Challenge, type ChallengeInput } from '@/lib/challenges'

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
    return NextResponse.json({
        challenges: visible,
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

    const { data: created, error } = await supabaseAdmin
        .from('challenges')
        .insert({
            title: input.title!.trim(),
            description: input.description?.trim() || null,
            metric: input.metric,
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
