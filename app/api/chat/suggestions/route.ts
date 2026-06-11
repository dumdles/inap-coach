import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAuth } from '@/app/api/_lib/auth'
import { generateStructured } from '@/app/api/_lib/ai'
import { getCoachProfile } from '@/app/api/_lib/coach-data'
import { firstNameOf } from '@/app/api/_lib/coach-prompt'

// Quick-reply chips for the AI coach. Two modes:
//   • follow-up — body has `conversation`: 3 chips continuing the chat.
//   • starter   — no `conversation`: 4 opening questions tailored to the
//     cadet's own profile (service, goal, upcoming IPPT, weight target).
const suggestionsSchema = z.object({
    suggestions: z.array(z.string().max(60)).min(2).max(4),
})

const FOLLOWUP_PROMPT = `You generate quick-reply chips for a fitness coaching chat between an Officer Cadet School (OCS) cadet in Singapore and their AI coach.

Given the recent conversation, suggest exactly 3 short follow-up messages the CADET might naturally send next, phrased in the cadet's first-person voice.

Rules:
- Max 8 words each. No numbering, no quotes, no emoji.
- Each chip must take the conversation somewhere different (drill deeper, related topic, practical next step).
- Stay within: nutrition, training, recovery, sleep, IPPT prep, the cadet's logged data.
- Never suggest anything medical, injury-related, or about rapid weight loss.`

const STARTER_PROMPT = `You generate opening quick-question chips for the FitRep AI coach — used by an Officer Cadet School (OCS) cadet in Singapore the moment they open the chat.

Given the cadet's profile, suggest exactly 4 opening questions THEY might ask their coach, in the cadet's first-person voice. Tailor them to what stands out in the profile (their goal, service branch, an upcoming IPPT, a weight target).

Rules:
- Max 8 words each. No numbering, no quotes, no emoji.
- Make them feel personal and specific to this cadet, not generic.
- Cover a spread: nutrition, training, recovery/sleep, and progress or IPPT.
- Never suggest anything medical, injury-related, or about rapid weight loss.`

export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req)
    if ('error' in auth) return auth.error

    const body = await req.json().catch(() => ({}))
    const conversation = (body.conversation ?? '').toString().slice(0, 4000)

    try {
        // ── Follow-up mode ──────────────────────────────────
        if (conversation.trim()) {
            const { suggestions } = await generateStructured({
                schema: suggestionsSchema,
                system: FOLLOWUP_PROMPT,
                prompt: `Recent conversation:\n\n${conversation}\n\nGenerate the 3 follow-up chips.`,
                temperature: 0.8,
            })
            return NextResponse.json({ suggestions: suggestions.slice(0, 3) })
        }

        // ── Starter mode — personalised from the cadet's profile ──
        const profile = await getCoachProfile(auth.user.id)
        if (!profile) return NextResponse.json({ suggestions: [] })

        const age = profile.date_of_birth
            ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
            : null
        const profileSummary = [
            `First name: ${firstNameOf(profile) ?? 'unknown'}`,
            `Service branch: ${profile.service ?? 'unknown'}`,
            `Goal: ${profile.goal_mode ?? 'maintain'}`,
            profile.calorie_target ? `Daily calorie target: ${profile.calorie_target} kcal` : '',
            profile.weight_kg ? `Current weight: ${profile.weight_kg} kg` : '',
            age ? `Age: ${age}` : '',
            profile.ippt_date ? `Upcoming IPPT date: ${profile.ippt_date}` : 'No IPPT scheduled',
        ].filter(Boolean).join('\n')

        const { suggestions } = await generateStructured({
            schema: suggestionsSchema,
            system: STARTER_PROMPT,
            prompt: `Cadet profile:\n\n${profileSummary}\n\nGenerate the 4 opening chips.`,
            temperature: 0.9,
        })
        return NextResponse.json({ suggestions: suggestions.slice(0, 4) })
    } catch (err) {
        // Chips are decorative — fail soft with none rather than surfacing an error.
        console.error('[chat/suggestions] AI error:', err)
        return NextResponse.json({ suggestions: [] })
    }
}
