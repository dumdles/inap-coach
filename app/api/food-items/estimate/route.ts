import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = process.env.INSIGHTS_MODEL ?? 'google/gemini-2.0-flash-001'

const SYSTEM_PROMPT = `You are a nutrition data assistant specialised in Singapore and Asian food. Given a food name, estimate its macronutrients per 100g AND the typical portion size a person would eat.

Return ONLY valid JSON in this exact structure — no text outside the JSON object:
{
  "confidence": "high" | "medium" | "low" | "unrecognised",
  "calories_per_100g": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "typical_serving_g": number
}

Rules:
- Set "confidence" to "unrecognised" if the input is gibberish, random characters, a non-food word, or otherwise impossible to map to a real food. In that case you may still set all macro values to 0.
- Set "confidence" to "high" for well-known foods (e.g. chicken rice, McSpicy, white rice), "medium" for less common items, "low" for vague or unusual descriptions.
- All macro values are per 100g of the food as typically consumed (cooked weight where applicable).
- Round all macro values to one decimal place.
- calories_per_100g must be between 0 and 900.
- protein_g, carbs_g, fat_g must each be between 0 and 100.
- typical_serving_g is the weight in grams a single person would normally eat in one sitting (e.g. one McSpicy burger = 200g, one plate of chicken rice = 400g, one scoop of protein powder = 30g). Must be between 1 and 5000.
- If the food name is a branded item (e.g. McSpicy, Milo), use the known standard size.
- If the food name is ambiguous, use the most common preparation and serving (e.g. "chicken" = grilled skinless breast, 150g serving).
- Do not add any text, explanation, or markdown outside the JSON object.`

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}))
    const name = (body.name ?? '').toString().trim()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    if (name.length > 200) return NextResponse.json({ error: 'name too long' }, { status: 400 })

    const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'inap-coach',
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Estimate macros per 100g and typical serving size for: ${name}` },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
        }),
    })

    if (!response.ok) {
        console.error('[estimate] OpenRouter error:', response.status)
        return NextResponse.json({ error: 'ai_unavailable' }, { status: 502 })
    }

    const json = await response.json()
    let content: string = json.choices?.[0]?.message?.content ?? ''
    content = content.replace(/^```json?\n?([\s\S]*?)\n?```$/m, '$1').trim()

    let parsed: {
        confidence?: string
        calories_per_100g: number
        protein_g: number
        carbs_g: number
        fat_g: number
        typical_serving_g: number
    }
    try {
        parsed = JSON.parse(content)
    } catch {
        console.error('[estimate] Failed to parse AI response:', content)
        return NextResponse.json({ error: 'invalid_response' }, { status: 502 })
    }

    if (parsed.confidence === 'unrecognised') {
        return NextResponse.json({ error: 'unrecognised_food' }, { status: 422 })
    }

    return NextResponse.json({
        confidence: parsed.confidence ?? 'medium',
        calories_per_100g: Math.min(900,  Math.max(0,    Math.round(parsed.calories_per_100g   * 10) / 10)),
        protein_g:         Math.min(100,  Math.max(0,    Math.round(parsed.protein_g           * 10) / 10)),
        carbs_g:           Math.min(100,  Math.max(0,    Math.round(parsed.carbs_g             * 10) / 10)),
        fat_g:             Math.min(100,  Math.max(0,    Math.round(parsed.fat_g               * 10) / 10)),
        typical_serving_g: Math.min(5000, Math.max(1,    Math.round(parsed.typical_serving_g))),
    })
}
