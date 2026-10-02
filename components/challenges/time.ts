import { challengeStatus, type Challenge } from '@/lib/challenges'

// Human-friendly countdown text for challenge cards and headers.

function span(ms: number) {
    const m = Math.max(0, Math.round(ms / 60_000))
    if (m < 60) return `${m}m`
    const h = Math.round(m / 60)
    if (h < 48) return `${h}h`
    return `${Math.round(h / 24)}d`
}

export function timeLeftLabel(c: Pick<Challenge, 'starts_at' | 'ends_at'>, now = Date.now()) {
    const s = challengeStatus(c, now)
    if (s === 'upcoming') return `Starts in ${span(Date.parse(c.starts_at) - now)}`
    if (s === 'live') return `${span(Date.parse(c.ends_at) - now)} left`
    return `Ended ${new Date(c.ends_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' })}`
}

/** "2 Oct, 08:00 – 9 Oct, 08:00" in SGT */
export function windowLabel(c: Pick<Challenge, 'starts_at' | 'ends_at'>) {
    const f = (iso: string) => new Date(iso).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore' })
    return `${f(c.starts_at)} – ${f(c.ends_at)}`
}
