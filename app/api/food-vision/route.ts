import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouterVision } from '../_lib/ai'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScanIngredient = {
    name: string
    estimated_grams: number
    calories_per_100g: number
    protein_g: number
    carbs_g: number
    fat_g: number
}

export type ScanDish = {
    name: string
    total_grams: number
    // Weighted average macros computed server-side from ingredients
    calories_per_100g: number
    protein_g: number
    carbs_g: number
    fat_g: number
    confidence: 'high' | 'medium' | 'low'
    confidence_note: string | null
    ingredients: ScanIngredient[]
}

// Raw shape the AI returns before we compute dish-level macros
type RawDish = {
    name: unknown
    confidence: unknown
    confidence_note: unknown
    ingredients: Array<{
        name: unknown
        estimated_grams: unknown
        calories_per_100g: unknown
        protein_g: unknown
        carbs_g: unknown
        fat_g: unknown
    }>
}

// ─── System prompt ────────────────────────────────────────────────────────────

// Singapore-localised context. Instructs the AI to group components into dishes
// (e.g. Nasi Lemak = one dish, not seven separate ingredients) and return the
// ingredient breakdown so we can compute weighted-average macros server-side.
const SYSTEM_PROMPT = `You are a nutrition analysis AI specialised in Singapore food. Your task is to identify dishes in a photo and estimate their macronutrient content via an ingredient breakdown.

Context:
- Users are Singapore Army Officer Cadet School (OCS) cadets
- Weekday meals are often from SAF cookhouse (e.g. steamed rice with braised pork, steamed fish, stir-fried vegetables, clear soup)
- Weekend meals are from hawker centres, food courts, coffee shops, fast food chains, or restaurants

Food to recognise — be specific with names:

Hawker & local:
- Chicken rice (Hainanese/roasted/soy sauce), char siu rice, duck rice
- Char kway teow, fried hokkien mee, bee hoon goreng, mee siam
- Laksa, bak chor mee, wonton mee, fishball noodles, ban mian
- Nasi lemak (with fried chicken, half egg, sambal, ikan bilis, peanuts, cucumber)
- Roti prata (plain/egg/cheese), thosai, idli, appam
- Briyani (chicken/mutton), chicken curry rice, fish curry rice
- Nasi padang, rendang, satay, mee goreng, mee rebus
- Carrot cake (white/black), oyster omelette, popiah, kueh pie tee
- Teh tarik, kopi, milo, barley, chrysanthemum (~250ml default for drinks)
- Ice kachang, chendol, grass jelly drink, sugarcane juice

Fast food:
- McDonald's: McSpicy, Big Mac, McChicken, Quarter Pounder, Filet-O-Fish, Egg McMuffin, fries (small/medium/large), McFlurry, apple pie
- KFC: Original Recipe / Crispy chicken (pieces), Zinger Burger, Twister Wrap, coleslaw, mashed potato with gravy
- Burger King: Whopper, Mushroom Swiss, Chicken Royale, onion rings
- Subway: 6-inch / footlong sub (specify protein), wraps
- Jollibee: Chickenjoy (1/2 pcs), Yum Burger, spaghetti with sauce
- Popeyes: spicy/mild fried chicken, chicken sandwich
- Shake Shack: ShackBurger, SmokeShack, crinkle-cut fries, milkshake
- Nando's: quarter / half PERi-PERi chicken, pita, wrap, sides (coleslaw, corn, rice)
- A&W: Mozza Burger, Coney Dog, curly fries, waffles

Restaurants:
- Wingstop: classic bone-in / boneless wings (Lemon Pepper, Cajun, Original Hot, Garlic Parmesan, Louisiana Rub), fries, tenders
- 4Fingers: Korean fried chicken wings / drumlets (soy garlic / spicy), burgers, fries
- Mala Tang: spicy mala hot pot — estimate per skewer / piece (e.g. beef ball, fishcake, tofu, mushroom, leafy veg, noodles, pig intestine)
- Hai Di Lao: hot pot — beef / mutton / pork slices, prawns, mushrooms, tofu, leafy vegetables, noodles, sesame sauce
- Korean BBQ: samgyeopsal (pork belly), beef bulgogi, galbi, rice, banchan
- Japanese: sushi / sashimi sets, tonkotsu / chashu ramen, chicken katsu don, tempura set, teriyaki chicken set
- Taiwanese: gua bao, beef noodle soup, oyster vermicelli, bubble tea (specify size, sugar level if visible)

Instructions:
1. Identify each distinct DISH in the photo (a plate, bowl, cup, or individual item is one dish).
   - Group ALL components together: "Nasi Lemak" is ONE dish — its rice, sambal, egg, ikan bilis, peanuts, and cucumber are ingredients, NOT separate dishes.
   - A set meal: burger = one dish, fries = one dish, drink = one dish.
2. For each dish, list its ingredient components with individual macro estimates.
   - Simple items (a banana, a plain drink, a single wrapped burger): ingredients = one entry matching the dish name.
   - Complex dishes (Nasi Lemak, curry rice with sides, laksa): list each visible component separately.
3. For drinks: default to 250ml = 250g unless the cup size suggests otherwise.
4. Assign confidence at the DISH level:
   - "high" — dish clearly identifiable with a well-known macro profile
   - "medium" — recognisable but portion size, sauce, or preparation is hard to gauge
   - "low" — hard to identify, heavily mixed, or obscured
5. For "medium" or "low", add a brief confidence_note (e.g. "sauce coating makes fat estimate uncertain").

All macro values (calories_per_100g, protein_g, carbs_g, fat_g) are PER 100G of that ingredient.
estimated_grams is the actual weight of that ingredient in this serving.

Return ONLY valid JSON — no markdown fences, no explanation outside the JSON.
Schema:
{
  "dishes": [
    {
      "name": string,
      "confidence": "high" | "medium" | "low",
      "confidence_note": string | null,
      "ingredients": [
        {
          "name": string,
          "estimated_grams": number,
          "calories_per_100g": number,
          "protein_g": number,
          "carbs_g": number,
          "fat_g": number
        }
      ]
    }
  ]
}

If no food is visible in the image, return { "dishes": [] }.`

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    if (!process.env.OPENROUTER_API_KEY) {
        return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
    }

    let imageBase64: string
    let mimeType: string
    try {
        const body = await req.json()
        imageBase64 = body.imageBase64
        mimeType = body.mimeType ?? 'image/jpeg'
        if (!imageBase64 || typeof imageBase64 !== 'string') throw new Error('missing imageBase64')
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    let raw: string
    try {
        const dataUrl = `data:${mimeType};base64,${imageBase64}`
        // response_format is intentionally omitted — some vision models on OpenRouter
        // reject json_object mode when processing images. The system prompt demands JSON.
        raw = await callOpenRouterVision([
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: dataUrl } },
                    { type: 'text', text: 'Identify all dishes in this photo and return the JSON.' },
                ],
            },
        ])
    } catch (err) {
        const status = (err as { status?: number }).status
        const detail = err instanceof Error ? err.message : String(err)
        if (status === 429) {
            return NextResponse.json({ error: 'Too many scans — please wait a moment and try again.', detail }, { status: 429 })
        }
        return NextResponse.json({ error: 'Photo scanning is unavailable right now. Try again shortly or add the food manually.', detail }, { status: 502 })
    }

    let parsed: { dishes: RawDish[] }
    try {
        parsed = JSON.parse(raw) as { dishes: RawDish[] }
        if (!Array.isArray(parsed.dishes)) throw new Error(`unexpected shape: ${JSON.stringify(parsed).slice(0, 200)}`)
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: 'Got an unexpected response from AI — please try again.', detail: `${detail} | raw: ${raw?.slice(0, 300)}` }, { status: 502 })
    }

    // Sanitise ingredients and compute dish-level macros as a weighted average.
    // Doing this server-side avoids trusting the AI's arithmetic.
    const dishes: ScanDish[] = parsed.dishes.map(dish => {
        const ingredients: ScanIngredient[] = (dish.ingredients ?? []).map(ing => ({
            name: String(ing.name ?? 'Ingredient'),
            estimated_grams: Math.max(1, Math.min(2000, Math.round(Number(ing.estimated_grams) || 50))),
            calories_per_100g: Math.max(0, Math.min(900, Math.round(Number(ing.calories_per_100g) || 0))),
            protein_g: Math.max(0, Math.min(100, parseFloat((Number(ing.protein_g) || 0).toFixed(1)))),
            carbs_g: Math.max(0, Math.min(100, parseFloat((Number(ing.carbs_g) || 0).toFixed(1)))),
            fat_g: Math.max(0, Math.min(100, parseFloat((Number(ing.fat_g) || 0).toFixed(1)))),
        }))

        const totalGrams = ingredients.reduce((s, ing) => s + ing.estimated_grams, 0) || 100
        const totalCal = ingredients.reduce((s, ing) => s + ing.calories_per_100g * ing.estimated_grams / 100, 0)
        const totalPro = ingredients.reduce((s, ing) => s + ing.protein_g * ing.estimated_grams / 100, 0)
        const totalCarb = ingredients.reduce((s, ing) => s + ing.carbs_g * ing.estimated_grams / 100, 0)
        const totalFat = ingredients.reduce((s, ing) => s + ing.fat_g * ing.estimated_grams / 100, 0)

        return {
            name: String(dish.name ?? 'Unknown dish'),
            total_grams: totalGrams,
            calories_per_100g: Math.round(totalCal / totalGrams * 100),
            protein_g: parseFloat((totalPro / totalGrams * 100).toFixed(1)),
            carbs_g: parseFloat((totalCarb / totalGrams * 100).toFixed(1)),
            fat_g: parseFloat((totalFat / totalGrams * 100).toFixed(1)),
            confidence: (['high', 'medium', 'low'] as const).includes(dish.confidence as 'high' | 'medium' | 'low')
                ? (dish.confidence as 'high' | 'medium' | 'low')
                : 'low',
            confidence_note: dish.confidence_note ? String(dish.confidence_note) : null,
            ingredients,
        }
    })

    return NextResponse.json({ dishes })
}
