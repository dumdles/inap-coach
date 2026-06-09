import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/app/api/_lib/auth'
import { callOpenRouter } from '@/app/api/_lib/ai'

// Full-day plan: 5 slots, 2 options each, protein shakes/bars in snack slots.
const SYSTEM_PROMPT = `You are a sports nutrition coach for OCS cadets in Singapore. Create a personalised full-day meal plan.

Return ONLY valid JSON — no text outside the object:
{
  "plan": [
    {
      "slot": "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner",
      "time": "suggested time window e.g. 0630–0730",
      "options": [
        {
          "name": "short meal name",
          "description": "what the meal is, max 12 words",
          "macros": { "calories": number, "protein": number, "carbs": number, "fat": number },
          "tip": "one practical prep or timing tip, max 15 words"
        },
        { /* second distinct option — same structure */ }
      ]
    }
  ]
}

Rules:
- Include EXACTLY 5 slots in order: breakfast, morning_snack, lunch, afternoon_snack, dinner.
- Each slot MUST have exactly 2 options.
- morning_snack and afternoon_snack: one option must be a protein shake or bar (name a real brand available in Singapore, e.g. Optimum Nutrition, Myprotein, ON Gold Standard).
- Options within a slot must be distinctly different (e.g. hawker vs home-prep, Asian vs Western, hot vs grab-and-go).
- Use Singapore-accessible food: hawker centres, NTUC FairPrice, 7-Eleven, canteen, cookhouse.
- Time suggestions should reflect a typical OCS training day (early rise ~0600, lights out ~2230).
- Round all macros to the nearest integer. calories must approximately equal 4×protein + 4×carbs + 9×fat.
- Do not add any text outside the JSON object.`

type MealOption = {
    name: string
    description: string
    macros: { calories: number; protein: number; carbs: number; fat: number }
    tip: string
}

type MealSlot = {
    slot: string
    time: string
    options: [MealOption, MealOption]
}

export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req)
    if ('error' in auth) return auth.error

    const body = await req.json().catch(() => ({}))
    const { weight_kg, height_cm, age, gender, goal_mode, activity_level, eer, protein_g, body_fat_pct, waist_cm, goal_notes, service } = body

    if (!weight_kg || !height_cm || !eer || !protein_g) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const lines = [
        `Cadet: ${gender ?? 'unknown'}, age ${age ?? '?'}, ${weight_kg} kg, ${height_cm} cm`,
        body_fat_pct ? `Body fat: ${body_fat_pct}%` : '',
        waist_cm ? `Waist: ${waist_cm} cm` : '',
        service ? `Service: ${service}` : '',
        `Goal: ${goal_mode ?? 'maintain'} | Activity: ${activity_level ?? 'moderate'}`,
        `Daily targets: ${eer} kcal total, ${protein_g} g protein`,
        goal_notes?.trim() ? `Preferences: ${goal_notes.trim()}` : '',
    ].filter(Boolean).join('\n')

    let parsed: { plan: MealSlot[] }
    try {
        const content = await callOpenRouter(
            [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: lines },
            ],
            { temperature: 0.65, response_format: { type: 'json_object' } },
        )
        parsed = JSON.parse(content) as { plan: MealSlot[] }
    } catch (err) {
        console.error('[meal-plan] OpenRouter error:', err)
        return NextResponse.json({ error: 'ai_unavailable' }, { status: 502 })
    }

    if (!Array.isArray(parsed.plan) || parsed.plan.length === 0) {
        return NextResponse.json({ error: 'invalid_response' }, { status: 502 })
    }

    return NextResponse.json({ plan: parsed.plan.slice(0, 5) })
}
