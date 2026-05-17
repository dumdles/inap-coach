import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'

// Apple Health export.xml contains entries like:
// <Record type="HKCategoryTypeIdentifierSleepAnalysis"
//         sourceName="Apple Watch"
//         startDate="2024-05-12 23:14:31 +0800"
//         endDate="2024-05-13 06:42:10 +0800"
//         value="HKCategoryValueSleepAnalysisAsleepCore" />
//
// Sleep stage values can be:
//   HKCategoryValueSleepAnalysisInBed
//   HKCategoryValueSleepAnalysisAsleep              (older devices)
//   HKCategoryValueSleepAnalysisAsleepUnspecified
//   HKCategoryValueSleepAnalysisAsleepCore          (light)
//   HKCategoryValueSleepAnalysisAsleepDeep
//   HKCategoryValueSleepAnalysisAsleepREM
//   HKCategoryValueSleepAnalysisAwake
//
// We group consecutive non-Awake records by night and sum minutes per stage.

type SleepStage = 'light' | 'deep' | 'rem' | 'unspecified' | 'awake' | 'in_bed'

type RawRecord = {
    start: Date
    end: Date
    stage: SleepStage
}

function classifyStage(value: string): SleepStage {
    if (value.includes('AsleepDeep')) return 'deep'
    if (value.includes('AsleepREM')) return 'rem'
    if (value.includes('AsleepCore')) return 'light'
    if (value.includes('Awake')) return 'awake'
    if (value.includes('InBed')) return 'in_bed'
    return 'unspecified'
}

// Apple's dates look like "2024-05-12 23:14:31 +0800". Convert to a parseable ISO form.
function parseAppleDate(s: string): Date {
    // "2024-05-12 23:14:31 +0800" → "2024-05-12T23:14:31+08:00"
    const normalized = s.replace(' ', 'T').replace(/\s([+-])(\d{2})(\d{2})$/, '$1$2:$3')
    return new Date(normalized)
}

// Compute the "night" a sleep block belongs to. We use the date the sleep ENDED
// (i.e. when you woke up). If end is before 4am, that night still "belongs"
// to the previous calendar evening — but assigning by end-date is the convention
// used elsewhere in this codebase (Polar does the same).
function nightDate(end: Date): string {
    return end.toISOString().slice(0, 10)
}

// Parse a chunk of XML and extract sleep records. We use a regex rather than a
// full XML parser because Apple Health exports are typically >50 MB and we only
// want a tiny subset of attributes — regex is faster and uses no extra deps.
const RECORD_REGEX = /<Record\s+([^>]*?)\/>/g
const ATTR_REGEX = /(\w+)="([^"]*)"/g

function extractSleepRecords(xml: string): RawRecord[] {
    const out: RawRecord[] = []
    let match: RegExpExecArray | null

    while ((match = RECORD_REGEX.exec(xml)) !== null) {
        const inner = match[1]
        if (!inner.includes('HKCategoryTypeIdentifierSleepAnalysis')) continue

        const attrs: Record<string, string> = {}
        let attrMatch: RegExpExecArray | null
        ATTR_REGEX.lastIndex = 0
        while ((attrMatch = ATTR_REGEX.exec(inner)) !== null) {
            attrs[attrMatch[1]] = attrMatch[2]
        }

        const startStr = attrs.startDate
        const endStr = attrs.endDate
        const value = attrs.value
        if (!startStr || !endStr || !value) continue

        const start = parseAppleDate(startStr)
        const end = parseAppleDate(endStr)
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) continue

        out.push({ start, end, stage: classifyStage(value) })
    }
    return out
}

// Group records into "nights" — consecutive sleep blocks that fall within a few
// hours of each other. We use a simple rule: anything within the same calendar
// wake-up date is the same night.
type Night = {
    night_date: string
    sleep_start: Date
    sleep_end: Date
    deep_min: number
    rem_min: number
    light_min: number
    awake_min: number
    duration_min: number   // time actually asleep (excludes awake)
}

function groupIntoNights(records: RawRecord[]): Night[] {
    const byNight = new Map<string, Night>()

    for (const r of records) {
        const date = nightDate(r.end)
        const min = (r.end.getTime() - r.start.getTime()) / 60000

        let night = byNight.get(date)
        if (!night) {
            night = {
                night_date: date,
                sleep_start: r.start,
                sleep_end: r.end,
                deep_min: 0, rem_min: 0, light_min: 0, awake_min: 0,
                duration_min: 0,
            }
            byNight.set(date, night)
        }

        if (r.start < night.sleep_start) night.sleep_start = r.start
        if (r.end   > night.sleep_end)   night.sleep_end   = r.end

        switch (r.stage) {
            case 'deep':  night.deep_min  += min; night.duration_min += min; break
            case 'rem':   night.rem_min   += min; night.duration_min += min; break
            case 'light':
            case 'unspecified': night.light_min += min; night.duration_min += min; break
            case 'awake': night.awake_min += min; break
            // in_bed records overlap stage records — don't double-count
            case 'in_bed': break
        }
    }

    return [...byNight.values()]
        .map(n => ({
            ...n,
            deep_min: Math.round(n.deep_min),
            rem_min: Math.round(n.rem_min),
            light_min: Math.round(n.light_min),
            awake_min: Math.round(n.awake_min),
            duration_min: Math.round(n.duration_min),
        }))
        .filter(n => n.duration_min >= 60)   // skip nights with <1h of sleep — likely noise
}

// POST /api/sleep-logs/import-apple-health
// Body: multipart/form-data with fields:
//   userId — string
//   file   — the export.xml from iOS Health app
export async function POST(req: NextRequest) {
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })

    const userId = form.get('userId')
    const file = form.get('file')
    if (typeof userId !== 'string' || !userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }
    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    // Cap at 200 MB to avoid memory blowups. Most exports are 5–80 MB.
    if (file.size > 200 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 200 MB)' }, { status: 413 })
    }

    const xml = await file.text()
    const records = extractSleepRecords(xml)
    const nights = groupIntoNights(records)

    if (nights.length === 0) {
        return NextResponse.json({
            ok: true,
            nights_imported: 0,
            note: 'No sleep records found. Make sure you exported the full Health archive (Profile → Export All Health Data).',
        })
    }

    // Upsert in chunks so we don't blow the request size on Supabase.
    const CHUNK = 100
    let imported = 0
    for (let i = 0; i < nights.length; i += CHUNK) {
        const chunk = nights.slice(i, i + CHUNK).map(n => ({
            user_id: userId,
            source: 'apple_health' as const,
            night_date: n.night_date,
            sleep_start: n.sleep_start.toISOString(),
            sleep_end: n.sleep_end.toISOString(),
            duration_min: n.duration_min,
            deep_min: n.deep_min,
            rem_min: n.rem_min,
            light_min: n.light_min,
            awake_min: n.awake_min,
        }))
        const { error } = await supabaseAdmin
            .from('sleep_logs')
            .upsert(chunk, { onConflict: 'user_id,night_date' })
        if (error) {
            console.error('[apple-health] upsert error:', error.message)
            return NextResponse.json({ error: error.message, imported }, { status: 500 })
        }
        imported += chunk.length
    }

    return NextResponse.json({ ok: true, nights_imported: imported })
}
