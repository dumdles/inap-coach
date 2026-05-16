import { NextRequest, NextResponse } from 'next/server'
import { fetchPolar } from '@/lib/polar'
import { supabaseAdmin } from '@/app/api/cron/_lib'

// ── Polar AccessLink response shapes ──────────────────────────────────────
// https://www.polar.com/accesslink-api/

type PolarSleepNight = {
    polar_user?: string
    date?: string                          // "2024-05-13" — date of waking
    sleep_start_time?: string              // ISO-8601 timestamp
    sleep_end_time?: string                // ISO-8601 timestamp
    continuity?: number
    continuity_class?: number
    light_sleep?: number                   // seconds
    deep_sleep?: number                    // seconds
    rem_sleep?: number                     // seconds
    unrecognized_sleep_stage?: number      // seconds
    sleep_score?: number                   // 0–100
    total_interruption_duration?: number   // seconds
    sleep_charge?: number
    sleep_rating?: number
    short_interruption_duration?: number
    long_interruption_duration?: number
    sleep_cycles?: number
    group_duration_score?: number
    group_solidity_score?: number
    group_regeneration_score?: number
}

type PolarSleepResponse = { nights?: PolarSleepNight[] }

type NightlyRechargeRecord = {
    polar_user?: string
    date?: string                          // "2024-05-13"
    heart_rate_avg?: number
    heart_rate_variability_avg?: number
    breathing_rate_avg?: number
    nightly_recharge_status?: number       // 1-5
    ans_charge?: number
    ans_charge_status?: number             // 1-5
    beat_to_beat_avg?: number
}

type NightlyRechargeResponse = { recharges?: NightlyRechargeRecord[] }

// Polar's ans_charge_status uses string labels in some API versions.
function ansStatusToInt(raw: unknown): number | null {
    if (typeof raw === 'number') return raw >= 1 && raw <= 5 ? raw : null
    if (typeof raw !== 'string') return null
    const lookup: Record<string, number> = {
        much_below_usual: 1, below_usual: 2, usual: 3, above_usual: 4, much_above_usual: 5,
        MUCH_BELOW_USUAL: 1, BELOW_USUAL: 2, USUAL: 3, ABOVE_USUAL: 4, MUCH_ABOVE_USUAL: 5,
    }
    return lookup[raw] ?? null
}

function secondsToMinutes(sec: number | undefined | null): number | null {
    if (sec == null) return null
    return Math.round(sec / 60)
}

// GET /api/polar/sleep?userId=<uuid>
//
// Fetches the latest sleep nights + nightly recharge from Polar AccessLink,
// merges them by date, and upserts them into the sleep_logs table.
export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    let sleepData: PolarSleepResponse = {}
    let rechargeData: NightlyRechargeResponse = {}

    try {
        sleepData = await fetchPolar(userId, '/users/sleep') as PolarSleepResponse
    } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (!msg.includes('status 404')) {
            return NextResponse.json({ error: msg || 'Polar sleep fetch failed' }, { status: 500 })
        }
    }

    try {
        rechargeData = await fetchPolar(userId, '/users/nightly-recharge') as NightlyRechargeResponse
    } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (!msg.includes('status 404')) {
            // Recharge is optional — don't fail the whole sync if it's unavailable.
            console.warn('[polar/sleep] nightly recharge fetch failed:', msg)
        }
    }

    const nights = sleepData.nights ?? []
    const recharges = rechargeData.recharges ?? []

    // Index recharge by date so we can merge on `date` (the wake-up day).
    const rechargeByDate = new Map<string, NightlyRechargeRecord>()
    for (const r of recharges) {
        if (r.date) rechargeByDate.set(r.date, r)
    }

    const payloads: Record<string, unknown>[] = []

    for (const night of nights) {
        if (!night.date || !night.sleep_start_time || !night.sleep_end_time) continue

        const start = new Date(night.sleep_start_time)
        const end = new Date(night.sleep_end_time)
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) continue

        const durationMin = Math.round((end.getTime() - start.getTime()) / 60000)
        const recharge = rechargeByDate.get(night.date)

        payloads.push({
            user_id: userId,
            source: 'polar',
            night_date: night.date,
            sleep_start: start.toISOString(),
            sleep_end: end.toISOString(),
            duration_min: durationMin,
            sleep_score: night.sleep_score ?? null,
            ans_charge_status: ansStatusToInt(recharge?.ans_charge_status ?? recharge?.nightly_recharge_status),
            deep_min: secondsToMinutes(night.deep_sleep),
            rem_min: secondsToMinutes(night.rem_sleep),
            light_min: secondsToMinutes(night.light_sleep),
            awake_min: secondsToMinutes(night.total_interruption_duration),
            heart_rate_avg: recharge?.heart_rate_avg ?? null,
            hrv_avg: recharge?.heart_rate_variability_avg ?? null,
            polar_date: night.date,
        })
    }

    let inserted = 0
    if (payloads.length > 0) {
        const { error } = await supabaseAdmin
            .from('sleep_logs')
            .upsert(payloads, { onConflict: 'user_id,night_date' })
        if (error) {
            console.warn('[polar/sleep] upsert error:', error.message)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        inserted = payloads.length
    }

    return NextResponse.json({
        ok: true,
        nights_fetched: nights.length,
        recharges_fetched: recharges.length,
        inserted,
    })
}
