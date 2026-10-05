// ── Demo wing ─────────────────────────────────────────────────────────────────
// A fake wing of ~150 cadets (4 platoons × 4 sections) for previewing My Wing at
// real scale without real data — superadmins switch it on from the My Wing
// header. Generated in the browser from a fixed seed, so it looks the same every
// time; nothing is read from or written to the database.
//
// The data tells a story on purpose: most cadets log daily, some are patchy,
// a handful have gone silent, Platoon 2 / Section 3 is struggling, and three
// new cadets haven't been given a section yet.

import type { GoalMode, WingCadet } from '@/lib/wing-overview'

const FIRST = ['Wei Jie', 'Jun Hao', 'Marcus', 'Ryan', 'Darren', 'Isaac', 'Aaron', 'Joel', 'Zhi Hao', 'Ethan',
    'Arjun', 'Hafiz', 'Irfan', 'Daniel', 'Javier', 'Keagan', 'Nathan', 'Shawn', 'Bryan', 'Kai Xiang',
    'Ming Jie', 'Aloysius', 'Sean', 'Gabriel', 'Faris', 'Harith', 'Vikram', 'Rayner', 'Elijah', 'Jonas',
    'Priya', 'Rachel', 'Shu Ting', 'Nur Aisyah', 'Kathleen', 'Jia Hui', 'Prisha', 'Clara', 'Yi Xuan', 'Amanda']
const LAST = ['Tan', 'Lim', 'Ng', 'Lee', 'Wong', 'Goh', 'Chua', 'Teo', 'Ong', 'Koh', 'Chan', 'Low', 'Sim',
    'Yeo', 'Ho', 'Rahman', 'Iskandar', 'Kumar', 'Singh', 'Pillai', 'Fernandez', 'Lau', 'Chew', 'Seah']
const GOALS: GoalMode[] = ['bulk', 'bulk', 'cut', 'maintain', 'ippt', 'ippt']

/** Small deterministic PRNG (mulberry32) — same wing on every load. */
function rng(seed: number) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

type Profile = 'steady' | 'patchy' | 'silent'

export const DEMO_WING = 'Demo'

export function makeDemoWing(seed = 14): WingCadet[] {
    const r = rng(seed)
    const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
    const used = new Set<string>()
    const name = () => {
        for (;;) {
            const n = `${pick(LAST)} ${pick(FIRST)}`
            if (!used.has(n)) { used.add(n); return n }
        }
    }

    const rows: Omit<WingCadet, 'position'>[] = []
    let id = 0
    const add = (platoon: string | null, section: string | null, profile: Profile) => {
        // Meals per day for the last 7 days (oldest → today).
        const last7 = Array.from({ length: 7 }, (_, day) => {
            const isToday = day === 6
            if (profile === 'silent') return day < 2 && r() < 0.4 ? 1 + Math.floor(r() * 2) : 0
            const pLog = profile === 'steady' ? (isToday ? 0.72 : 0.94) : (isToday ? 0.3 : 0.38)
            return r() < pLog ? 1 + Math.floor(r() * 3) : 0
        })
        let streak = 0
        for (let i = 6; i >= 0 && last7[i] > 0; i--) streak++
        if (streak === 7) streak += Math.floor(r() * 12) // long streaks run past the window
        const logged = last7.filter(n => n > 0).length
        const meals = last7.reduce((s, n) => s + n, 0)
        const score = Math.min(900, Math.round(logged * 55 + meals * 14 + r() * 120 + (profile === 'steady' ? 60 : 0)))
        rows.push({
            id: `demo-${++id}`, full_name: name(), rank: 'OCT', wing: DEMO_WING, platoon, section,
            goal_mode: pick(GOALS), score: profile === 'silent' ? Math.round(score * 0.4) : score,
            streak, mealsToday: last7[6], last7,
        })
    }

    for (const platoon of ['1', '2', '3', '4']) {
        for (const section of ['1', '2', '3', '4']) {
            const size = 8 + Math.floor(r() * 3)            // 8–10 per section → ~147
            const struggling = platoon === '2' && section === '3'
            for (let i = 0; i < size; i++) {
                const x = r()
                const profile: Profile = struggling
                    ? (x < 0.4 ? 'silent' : x < 0.95 ? 'patchy' : 'steady')
                    : (x < 0.04 ? 'silent' : x < 0.2 ? 'patchy' : 'steady')
                add(platoon, section, profile)
            }
        }
    }
    // New arrivals without a section yet.
    for (let i = 0; i < 3; i++) add(String(1 + (i % 4)), null, 'patchy')

    return rows
        .sort((a, b) => b.score - a.score)
        .map((c, i) => ({ ...c, position: i + 1 }))
}

export function isDemoCadet(id: string) {
    return id.startsWith('demo-')
}
