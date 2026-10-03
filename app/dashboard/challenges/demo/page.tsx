'use client'

// ── Challenge demo ────────────────────────────────────────────────────────────
// A playable walkthrough of a challenge with fake cadets — for showing
// instructors / superiors how it works without touching real data. Everything
// stays in this browser tab: the quick log adds fake reps, "Finish now" ends
// and pays out the challenge, and a podium finish triggers the real win
// celebration (confetti + shareable image). Scoring uses the real rules — see
// lib/challenge-demo.ts.

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FlaskConical, Flag, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useData } from '@/lib/use-data'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ChallengeArena } from '@/components/challenges/arena'
import { DEMO_ME, addDemoReps, demoDetail, makeDemo, type DemoState } from '@/lib/challenge-demo'

export default function ChallengeDemoPage() {
    // Your real name on the fake leaderboard + share image (cached profile).
    const { data: me } = useData<{ rank: string | null; full_name: string | null }>('profile:challenge-demo', async uid => {
        const { data, error } = await supabase.from('users').select('rank, full_name').eq('id', uid).single()
        if (error) throw error
        return data
    })
    const myName = [me?.rank, me?.full_name].filter(Boolean).join(' ') || 'OCT You'

    const [now, setNow] = useState(() => Date.now())
    const [demo, setDemo] = useState<DemoState>(() => makeDemo(Date.now()))
    const [finished, setFinished] = useState(false)

    // Put your name on "your" fake row.
    const state = useMemo<DemoState>(() => ({
        ...demo,
        participants: demo.participants.map(p => p.id === DEMO_ME ? { ...p, rank: me?.rank ?? 'OCT', full_name: me?.full_name ?? 'You' } : p),
    }), [demo, me])
    const d = useMemo(() => demoDetail(state, now, finished), [state, now, finished])
    const myPlace = d.mine?.place ?? 0

    // Which step of the walkthrough you're on.
    const step = finished ? 3 : myPlace === 1 ? 2 : 1

    function finish() { setNow(Date.now()); setFinished(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    function reset() { const t = Date.now(); setNow(t); setDemo(makeDemo(t)); setFinished(false) }

    return (
        <div className="px-4 md:px-8 py-8 md:py-10 max-w-7xl mx-auto">
            <Link href="/dashboard/challenges" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
                <ArrowLeft size={14} /> Challenges
            </Link>

            {/* Demo banner + walkthrough */}
            <section className="mt-4 rounded-2xl border border-dashed border-primary/50 bg-primary/5 p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center shrink-0"><FlaskConical size={18} /></span>
                        <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-foreground">Demo — fake cadets, nothing is saved</div>
                            <ol className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                                {['Log an MTR set to overtake the leader', 'Finish the challenge', 'Celebrate and share your win'].map((label, i) => (
                                    <li key={label} className={cn('inline-flex items-center gap-1.5', step === i + 1 ? 'text-foreground font-semibold' : step > i + 1 ? 'text-muted-foreground line-through' : 'text-muted-foreground')}>
                                        <span className={cn('w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px] tabular-nums',
                                            step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted dark:bg-background')}>{i + 1}</span>
                                        {label}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {!finished && <Button onClick={finish}><Flag size={15} /> Finish now</Button>}
                        <Button variant="outline" onClick={reset}><RotateCcw size={15} /> Reset</Button>
                    </div>
                </div>
            </section>

            <ChallengeArena
                d={d} now={now} mineId={DEMO_ME} myName={myName} alwaysCelebrate
                // Quick log adds fake reps locally; the arena re-scores from them.
                submitReps={async rows => { const t = Date.now(); setDemo(s => addDemoReps(s, rows, t)); setNow(t); return true }}
                onRepsLogged={() => {}}
            />
        </div>
    )
}
