import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const PRIMARY_MODEL   = process.env.INSIGHTS_MODEL          ?? 'google/gemini-2.0-flash-001'
const FALLBACK_MODEL  = process.env.INSIGHTS_FALLBACK_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free'
const CACHE_HOURS = 24

const SYSTEM_PROMPT = `You are a supportive nutrition and fitness coach embedded in INAP Coach — a meal and health tracking app built exclusively for Officer Cadet School (OCS) cadets in Singapore. Do not mention, recommend, or reference any other apps, platforms, or external services.

Context about the cadets:
- OCS cadets are young, active adults undergoing intensive military training.
- They typically stay in camp Monday to Friday, where cookhouse meals are provided, and return home on weekends where they manage their own meals.
- Their training load is high, so adequate nutrition is critical for performance and recovery.
- Treat any gaps in logging on weekdays as likely cookhouse meals that weren't tracked, not as the cadet skipping food.

Tone guidelines:
- Be encouraging, positive, and growth-oriented. Frame every observation as an opportunity, not a failure.
- Acknowledge the difficulty of tracking nutrition in a military camp environment.
- Never sound judgmental or discouraging. Use language like "great opportunity to...", "building on...", "to keep up your momentum...".
- Address the cadet by their first name (provided in the profile) if available. Never address them by rank. If no name is available, use "Cadet".

Date and time awareness:
- You will be given the current Singapore time. If it is before 20:00 SGT today, dinner may not yet have been logged — do not penalise the cadet for missing dinner data on the current day.
- Similarly, if it is before 13:00 SGT, lunch and dinner for today may not yet be logged.
- Format all dates in DD/MM/YYYY.

Output rules:
- Return ONLY valid JSON in this exact structure — no text outside the JSON object:
{
  "summary": "2-3 sentence overall assessment, encouraging in tone",
  "insights": [
    {
      "id": "snake_case_slug",
      "priority": "high" | "medium" | "low",
      "category": "nutrition" | "weight" | "performance" | "recovery" | "adherence",
      "title": "Short action-oriented title (max 8 words)",
      "observation": "What the data shows (1-2 sentences, factual and neutral)",
      "action": "Encouraging, specific recommendation (1-2 sentences)"
    }
  ]
}
Return 3 to 5 insights. Sort by priority: high first. Do not add any text outside the JSON object.`

function toSGT(date = new Date()) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }))
}

function fmtDate(isoDate: string) {
    const [y, m, d] = isoDate.slice(0, 10).split('-')
    return `${d}/${m}/${y}`
}

const ANS_LABEL_INSIGHTS: Record<number, string> = {
    1: 'much below usual', 2: 'below usual', 3: 'usual', 4: 'above usual', 5: 'much above usual',
}

function buildUserMessage(user: Record<string, unknown>, dailySummaries: Record<string, unknown>[], weightLogs: Record<string, unknown>[], leaderboardScores: Record<string, unknown>[], sleepLogs: Record<string, unknown>[]) {
    const dob = user.date_of_birth as string | null
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : 'unknown'

    const sgt = toSGT()
    const sgtHour = sgt.getHours()
    const sgtDateStr = `${String(sgt.getDate()).padStart(2, '0')}/${String(sgt.getMonth() + 1).padStart(2, '0')}/${sgt.getFullYear()}`
    const sgtTimeStr = `${String(sgtHour).padStart(2, '0')}:${String(sgt.getMinutes()).padStart(2, '0')} SGT`

    const nutritionLines = dailySummaries.length
        ? dailySummaries.map(d => `${fmtDate(d.date as string)}: ${d.total_calories}kcal / ${d.calorie_target}kcal target, protein ${d.total_protein_g}g, carbs ${d.total_carbs_g}g, fat ${d.total_fat_g}g`).join('\n')
        : 'No data logged.'

    const weightLines = weightLogs.length
        ? weightLogs.map(w => {
            const date = fmtDate((w.logged_at as string).slice(0, 10))
            const bf = w.body_fat_pct != null ? `, ${w.body_fat_pct}% body fat` : ''
            const steps = w.polar_steps != null ? `, ${w.polar_steps} steps` : ''
            return `${date}: ${w.weight_kg}kg${bf}${steps}`
        }).join('\n')
        : 'No weight logs.'

    const scoreLines = leaderboardScores.length
        ? leaderboardScores.map(s => `Week of ${fmtDate(s.week_start as string)}: ${s.total_score} pts`).join('\n')
        : 'No score data.'

    const sleepLines = sleepLogs.length
        ? sleepLogs.map(s => {
            const date = fmtDate(s.night_date as string)
            const hours = ((s.duration_min as number) / 60).toFixed(1)
            const parts = [`${date}: ${hours}h slept`]
            if (s.sleep_score != null) parts.push(`score ${s.sleep_score}`)
            if (s.ans_charge_status != null) parts.push(`ANS ${ANS_LABEL_INSIGHTS[s.ans_charge_status as number]}`)
            if (s.deep_min != null && s.rem_min != null) parts.push(`deep ${s.deep_min}m / REM ${s.rem_min}m`)
            return parts.join(', ')
        }).join('\n')
        : 'No sleep data — encourage cadet to start tracking sleep for richer recovery insights.'

    const firstName = user.full_name
        ? (user.full_name as string).trim().split(' ')[0]
        : null

    const serviceContext: Record<string, string> = {
        'Army':      'High-volume field training, route marches, obstacle courses, and strength work. High caloric expenditure; protein and carb intake are critical for muscle repair and energy.',
        'Navy':      'Swim fitness, VO₂ endurance sessions, and maritime drills. Emphasis on aerobic capacity and hydration. Watch electrolyte intake given water-based training.',
        'Air Force': 'Aerobic base building, precision conditioning, and HIIT cycles. Moderate-to-high intensity; consistent energy intake matters more than peak loading.',
        'DIS':       'Balanced physical conditioning with cognitive performance demands. Training load is moderate; nutrition should support focus and sustained mental stamina.',
        'MIDS':      'Mixed-intensity training. Balanced macro targets; adequate sleep and recovery nutrition are especially important for adaptation.',
    }
    const serviceNote = user.service ? serviceContext[user.service as string] : null

    return `Current Singapore time: ${sgtDateStr} ${sgtTimeStr}

Cadet profile:
- First name: ${firstName ?? 'unknown'}, Rank: ${user.rank ?? 'unknown'}, Wing: ${user.wing ?? 'unknown'}
- Service: ${user.service ?? 'unknown'}${serviceNote ? ` — ${serviceNote}` : ''}
- Gender: ${user.gender ?? 'unknown'}, Age: ${age} years
- Height: ${user.height_cm ?? '?'}cm, Current weight: ${user.weight_kg ?? '?'}kg
- Goal: ${user.goal_mode ?? 'maintain'}, Daily calorie target: ${user.calorie_target ?? 'not set'} kcal
- IPPT date: ${user.ippt_date ? fmtDate(user.ippt_date as string) : 'not set'}

Nutrition (last 14 days, newest first):
${nutritionLines}

Weight logs (last 14 days):
${weightLines}

Sleep logs (last 14 nights, newest first). ANS = autonomic nervous system recharge from Polar:
${sleepLines}

Leaderboard scores (recent weeks):
${scoreLines}

When analysing, look for correlations between sleep and the rest of the data — e.g.
nights with poor sleep that followed late training, or weeks where high consistency
scores coincide with better sleep duration. Surface these as "recovery" or "performance"
insights when supported by the data.`
}

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

    if (!forceRefresh) {
        const { data: cached } = await supabaseAdmin
            .from('user_insights')
            .select('summary, insights, generated_at')
            .eq('user_id', userId)
            .single()

        if (cached) {
            const ageHours = (Date.now() - new Date(cached.generated_at).getTime()) / 3_600_000
            if (ageHours < CACHE_HOURS) return NextResponse.json(cached)
        }
    }

    const [userRes, summariesRes, weightRes, scoresRes, sleepRes] = await Promise.all([
        supabaseAdmin.from('users').select('goal_mode, activity_level, height_cm, weight_kg, gender, date_of_birth, ippt_date, rank, wing, service, calorie_target, full_name').eq('id', userId).single(),
        supabaseAdmin.from('daily_summaries').select('date, total_calories, total_protein_g, total_carbs_g, total_fat_g, calorie_target').eq('user_id', userId).order('date', { ascending: false }).limit(14),
        supabaseAdmin.from('weight_logs').select('weight_kg, body_fat_pct, polar_steps, logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(14),
        supabaseAdmin.from('leaderboard_scores').select('total_score, week_start').eq('user_id', userId).order('week_start', { ascending: false }).limit(4),
        supabaseAdmin.from('sleep_logs').select('night_date, duration_min, sleep_score, ans_charge_status, deep_min, rem_min').eq('user_id', userId).order('night_date', { ascending: false }).limit(14),
    ])

    if (!userRes.data) return NextResponse.json({ error: 'user not found' }, { status: 404 })

    const userMessage = buildUserMessage(
        userRes.data as Record<string, unknown>,
        (summariesRes.data ?? []) as Record<string, unknown>[],
        (weightRes.data ?? []) as Record<string, unknown>[],
        (scoresRes.data ?? []) as Record<string, unknown>[],
        (sleepRes.data ?? []) as Record<string, unknown>[],
    )

    async function callModel(model: string) {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'inap-coach',
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0.4,
                response_format: { type: 'json_object' },
            }),
        })
        if (!response.ok) throw Object.assign(new Error(`OpenRouter ${response.status}`), { status: response.status })
        const json = await response.json()
        let content: string = json.choices[0].message.content
        content = content.replace(/^```json?\n?([\s\S]*?)\n?```$/m, '$1').trim()
        return JSON.parse(content) as { summary: string; insights: unknown[] }
    }

    let parsed: { summary: string; insights: unknown[] }
    try {
        try {
            parsed = await callModel(PRIMARY_MODEL)
        } catch (primaryErr: unknown) {
            const status = (primaryErr as { status?: number }).status
            if (status === 429 || (status && status >= 500)) {
                console.warn(`[insights] Primary model (${PRIMARY_MODEL}) failed with ${status}, trying fallback (${FALLBACK_MODEL})`)
                parsed = await callModel(FALLBACK_MODEL)
            } else {
                throw primaryErr
            }
        }
    } catch (err) {
        console.error('[insights] OpenRouter error:', err)
        return NextResponse.json({ error: 'ai_unavailable' }, { status: 502 })
    }

    const now = new Date().toISOString()
    await supabaseAdmin.from('user_insights').upsert(
        { user_id: userId, summary: parsed.summary, insights: parsed.insights, generated_at: now },
        { onConflict: 'user_id' },
    )

    return NextResponse.json({ summary: parsed.summary, insights: parsed.insights, generated_at: now })
}
