import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAuth } from '@/app/api/_lib/auth'
import { generateStructured } from '@/app/api/_lib/ai'

// Follow-up chips shown under the coach's reply. The client sends the tail of
// the conversation as plain text; we return 3 short messages the cadet might
// tap to continue. Cheap one-shot call, no tools.
const suggestionsSchema = z.object({
    suggestions: z.array(z.string().max(60)).min(2).max(3),
})

const SYSTEM_PROMPT = `You generate quick-reply chips for a fitness coaching chat between an Officer Cadet School (OCS) cadet in Singapore and their AI coach.

Given the recent conversation, suggest exactly 3 short follow-up messages the CADET might naturally send next, phrased in the cadet's first-person voice.

Rules:
- Max 8 words each. No numbering, no quotes, no emoji.
- Each chip must take the conversation somewhere different (drill deeper, related topic, practical next step).
- Stay within: nutrition, training, recovery, sleep, IPPT prep, the cadet's logged data.
- Never suggest anything medical, injury-related, or about rapid weight loss.`

export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req)
    if ('error' in auth) return auth.error

    const body = await req.json().catch(() => ({}))
    const conversation = (body.conversation ?? '').toString().slice(0, 4000)
    if (!conversation.trim()) {
        return NextResponse.json({ error: 'conversation required' }, { status: 400 })
    }

    try {
        const { suggestions } = await generateStructured({
            schema: suggestionsSchema,
            system: SYSTEM_PROMPT,
            prompt: `Recent conversation:\n\n${conversation}\n\nGenerate the 3 follow-up chips.`,
            temperature: 0.8,
        })
        return NextResponse.json({ suggestions: suggestions.slice(0, 3) })
    } catch (err) {
        // Chips are decorative — fail soft with none rather than surfacing an error.
        console.error('[chat/suggestions] AI error:', err)
        return NextResponse.json({ suggestions: [] })
    }
}
