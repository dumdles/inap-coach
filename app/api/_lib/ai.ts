const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const PRIMARY_MODEL  = process.env.INSIGHTS_MODEL          ?? 'google/gemini-3.1-flash-lite'
export const FALLBACK_MODEL = process.env.INSIGHTS_FALLBACK_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free'

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

type CallOptions = {
    temperature?: number
    response_format?: { type: 'json_object' }
}

/**
 * Calls OpenRouter with the primary model and falls back to FALLBACK_MODEL on
 * 404 (model retired), 429 (rate limit), or 5xx (server error).
 * Returns the raw text content of the first choice.
 * Throws for unrecoverable errors (400, 401, 403).
 */
export async function callOpenRouter(messages: Message[], options: CallOptions = {}): Promise<string> {
    const { temperature = 0.4, response_format } = options

    async function call(model: string): Promise<string> {
        const res = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'fitrep',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                ...(response_format ? { response_format } : {}),
            }),
        })
        if (!res.ok) throw Object.assign(new Error(`OpenRouter ${res.status}`), { status: res.status })
        const json = await res.json()
        // Strip markdown code fences that some models add around JSON responses
        let content: string = json.choices[0].message.content
        content = content.replace(/^```json?\n?([\s\S]*?)\n?```$/m, '$1').trim()
        return content
    }

    try {
        return await call(PRIMARY_MODEL)
    } catch (err: unknown) {
        const status = (err as { status?: number }).status
        if (status === 404 || status === 429 || (status && status >= 500)) {
            console.warn(`[ai] ${PRIMARY_MODEL} failed (${status}), falling back to ${FALLBACK_MODEL}`)
            return await call(FALLBACK_MODEL)
        }
        throw err
    }
}
