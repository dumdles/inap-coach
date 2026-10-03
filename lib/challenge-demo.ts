// ── Challenge demo data ───────────────────────────────────────────────────────
// Fake cadets + MTR (Meal Time Regime) rep logs for the demo page
// (app/dashboard/challenges/demo). Nothing here touches the database: the demo
// scores the fake logs with the REAL rules (scoreParticipants, buildStandings,
// buildRace, computeAwards…), so what you see is exactly how a real challenge
// behaves — including finishing, paying out and celebrating a win.
//
// The setup is deliberately close: "you" start just behind the leader, so one
// MTR set (20 push-ups + 20 sit-ups + 10 pull-ups = 50 reps) takes 1st place.

import {
    buildRace, buildStandings, computeAwards, myStanding, scoreParticipants, summariseResults,
    type Challenge, type ChallengeLogs, type ComputedChallenge, type Participant,
} from '@/lib/challenges'

export const DEMO_ME = 'demo-me'
export const DEMO_EXERCISES = [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Push-ups', reps: 20 },
    { id: '00000000-0000-4000-8000-000000000002', name: 'Sit-ups', reps: 20 },
    { id: '00000000-0000-4000-8000-000000000003', name: 'Pull-ups', reps: 10 },
]
const SET_TOTAL = DEMO_EXERCISES.reduce((a, e) => a + e.reps, 0) // 50 reps per MTR set

const NAMES = [
    'Tan Wei Jie', 'Muhammad Hafiz', 'Lim Jun Hao', 'Rajesh Kumar', 'Ng Zhi Xuan', 'Chua Kai Wen', 'Ahmad Faris',
    'Goh Yi Xiang', 'Lee Ming Jie', 'Nur Iskandar', 'Wong Jia Le', 'Koh Shawn', 'Daniel Tan', 'Ryan Lim', 'Aaron Ong',
    'Vikram Nair', 'Teo Zheng Yu', 'Ho Jun Wei', 'Syafiq Rahman', 'Ethan Chong', 'Marcus Yeo', 'Benjamin Sim',
    'Javier Low', 'Arjun Pillai', 'Isaac Seah', 'Haziq Osman', 'Joel Quek',
]

const DAY = 86400_000
/** SGT calendar date (YYYY-MM-DD) of a timestamp. */
const sgDay = (t: number) => new Date(t + 8 * 3600_000).toISOString().slice(0, 10)

export type DemoState = { challenge: Challenge; participants: Participant[]; logs: ChallengeLogs }

/** A 7-day MTR challenge that started 5 days ago, with ~28 fake cadets. */
export function makeDemo(now: number, myName = 'You'): DemoState {
    let seed = 20261003
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

    const start = Date.parse(sgDay(now - 5 * DAY) + 'T00:00:00+08:00')
    const challenge: Challenge = {
        id: 'demo', title: 'Alpha MTR Showdown',
        description: '20 push-ups, 20 sit-ups and 10 pull-ups before every meal. Log each set — most reps wins.',
        metric: 'reps', exercise_ids: DEMO_EXERCISES.map(e => e.id),
        format: 'individual', team_level: null, scope_wing: 'Alpha', scope_platoon: null,
        starts_at: new Date(start).toISOString(), ends_at: new Date(start + 7 * DAY).toISOString(),
        bonus_points: 100, created_by: 'demo-staff', created_at: new Date(start - DAY).toISOString(),
        finalized_at: null, results: null,
    }

    const [myRank, ...myRest] = myName.split(' ')
    const participants: Participant[] = [
        { id: DEMO_ME, full_name: myRest.length && /^[A-Z0-9]{2,5}$/.test(myRank) ? myRest.join(' ') : myName, rank: myRest.length && /^[A-Z0-9]{2,5}$/.test(myRank) ? myRank : 'OCT', wing: 'Alpha', platoon: '2', section: '1', goal_mode: 'ippt', weight_kg: 70 },
        ...NAMES.map((n, i) => ({ id: `demo-${i}`, full_name: n, rank: 'OCT', wing: 'Alpha', platoon: String((i % 3) + 1), section: String((i % 4) + 1), goal_mode: 'maintain', weight_kg: 68 })),
    ]

    // Everyone else: before each meal (07:00, 12:00, 18:00 SGT), with a personal diligence level.
    const workouts: ChallengeLogs['workouts'] = []
    const set = (userId: string, t: number, extra = 0) => {
        for (const e of DEMO_EXERCISES)
            workouts.push({ user_id: userId, logged_at: new Date(t).toISOString(), template_id: e.id, sets: 1, reps: e.reps + (e.name === 'Push-ups' ? extra : 0), duration_min: null, distance_km: null })
    }
    const mealTimes = (dayStart: number) => [7, 12, 18].map(h => dayStart + h * 3600_000)
    for (const p of participants.slice(1)) {
        const diligence = 0.35 + rnd() * 0.6
        for (let d = 0; ; d++) {
            const dayStart = start + d * DAY
            if (dayStart > now) break
            for (const t of mealTimes(dayStart)) if (t < now - 3600_000 && rnd() < diligence) set(p.id, t, rnd() < 0.2 ? 10 : 0)
        }
    }

    // One clear leader; everyone else trails them by at least 70 reps (drop their
    // latest sets until they do), so the race at the top is you vs the leader.
    const score = (id: string) => workouts.filter(w => w.user_id === id).reduce((a, w) => a + (w.reps ?? 0), 0)
    const others = participants.slice(1).map(p => p.id).sort((a, b) => score(b) - score(a))
    const leader = score(others[0])
    for (const id of others.slice(1)) {
        while (score(id) > leader - 70) {
            const lastAt = workouts.filter(w => w.user_id === id).reduce((m, w) => (w.logged_at > m ? w.logged_at : m), '')
            for (let i = workouts.length - 1; i >= 0; i--) if (workouts[i].user_id === id && workouts[i].logged_at === lastAt) workouts.splice(i, 1)
        }
    }

    // You: 30 reps behind the leader (one MTR set away from 1st).
    let target = Math.max(SET_TOTAL, leader - Math.round(SET_TOTAL * 0.6)) // 30 behind
    const slots: number[] = []
    for (let dayStart = start; dayStart <= now; dayStart += DAY) for (const t of mealTimes(dayStart)) if (t < now - 3600_000) slots.push(t)
    for (const t of slots) if (target >= SET_TOTAL) { set(DEMO_ME, t); target -= SET_TOTAL }
    // Whatever's left (a partial set, or more if there weren't enough meals yet) goes on the last slot.
    if (target > 0) workouts.push({ user_id: DEMO_ME, logged_at: new Date(slots.at(-1) ?? start).toISOString(), template_id: DEMO_EXERCISES[0].id, sets: 1, reps: target, duration_min: null, distance_km: null })

    return { challenge, participants, logs: { workouts, meals: [], summaries: [], sleeps: [] } }
}

/** Log one quick-log set for "you" at `now` (what the demo's quick log calls). */
export function addDemoReps(s: DemoState, rows: { id: string; reps: number }[], now: number): DemoState {
    // A second in the past: scoring windows end exclusively at "now".
    const added = rows.map(r => ({ user_id: DEMO_ME, logged_at: new Date(now - 1000).toISOString(), template_id: r.id, sets: 1, reps: r.reps, duration_min: null, distance_km: null }))
    return { ...s, logs: { ...s.logs, workouts: [...s.logs.workouts, ...added] } }
}

/** Shape the demo like GET /api/challenges/[id] — live, or finished and paid out. */
export function demoDetail(s: DemoState, now: number, finished: boolean) {
    // Finishing = the challenge ends right now (every log so far is inside the window).
    const challenge: Challenge = finished ? { ...s.challenge, ends_at: new Date(now).toISOString() } : s.challenge
    const until = new Date(Math.min(now, Date.parse(challenge.ends_at))).toISOString()
    const scores = scoreParticipants(challenge.metric, challenge.starts_at, until, s.participants, s.logs, { exerciseIds: challenge.exercise_ids })
    const standings = buildStandings(challenge, s.participants, scores)
    const computed: ComputedChallenge = { participants: s.participants, scores, standings, logs: s.logs, scoredUntil: until }

    let myAward: { points: number; place: number } | null = null, awardedCount = 0
    if (finished) {
        const awards = computeAwards(challenge.bonus_points, standings, scores)
        challenge.finalized_at = new Date(now).toISOString()
        challenge.results = summariseResults(standings, s.participants.length, awards)
        const mine = awards.find(a => a.user_id === DEMO_ME)
        myAward = mine ? { points: mine.points, place: mine.place } : null
        awardedCount = awards.length
    }
    return {
        challenge,
        standings: standings.format === 'team'
            ? { format: 'team' as const, rows: standings.rows.map(({ memberIds, ...t }) => ({ ...t, isMine: memberIds.includes(DEMO_ME) })) }
            : standings,
        participants: s.participants.length,
        mine: myStanding(challenge, computed, DEMO_ME),
        myAward, awardedCount,
        canManage: false,
        race: buildRace(challenge, computed, DEMO_ME),
        exercises: DEMO_EXERCISES.map(({ id, name }) => ({ id, name })),
    }
}
