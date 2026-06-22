import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import type { LanguageModel } from 'ai'
import type { z } from 'zod'

// Model IDs are configurable via env so we can swap models without a deploy.
export const PRIMARY_MODEL  = process.env.INSIGHTS_MODEL          ?? 'google/gemini-3.1-flash-lite'
export const FALLBACK_MODEL = process.env.INSIGHTS_FALLBACK_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free'
// The chat coach needs a model with reliable tool-calling support. Defaults to
// the primary insights model, but can be overridden independently.
export const CHAT_MODEL = process.env.CHAT_MODEL ?? PRIMARY_MODEL

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

/**
 * Language model used for one-shot generations (insights, macro estimates,
 * meal plans). The `models` option is OpenRouter's native fallback routing:
 * if the primary model errors or is rate-limited, OpenRouter retries the
 * request with the fallback model server-side.
 */
export function aiModel(): LanguageModel {
    return openrouter(PRIMARY_MODEL, { models: [FALLBACK_MODEL] })
}

/** Language model used by the streaming AI coach chat (tool calling enabled). */
export function chatModel(): LanguageModel {
    return openrouter(CHAT_MODEL, { models: [FALLBACK_MODEL] })
}

/**
 * Generates a schema-validated object from the model. This replaces the old
 * pattern of asking for "JSON only" in the prompt and manually parsing the
 * response — the AI SDK enforces the schema and returns a typed result.
 *
 * Usage:
 *   const data = await generateStructured({ schema, system, prompt })
 */
export async function generateStructured<SCHEMA extends z.ZodType>(opts: {
    schema: SCHEMA
    system: string
    prompt: string
    temperature?: number
}): Promise<z.infer<SCHEMA>> {
    const { schema, system, prompt, temperature = 0.4 } = opts
    const result = await generateText({
        model: aiModel(),
        system,
        prompt,
        temperature,
        output: Output.object({ schema }),
    })
    return result.output as z.infer<SCHEMA>
}

// ─── Vision (multimodal) ─────────────────────────────────────────────────────

// Gemini 3.5 Flash has confirmed vision support on OpenRouter
export const VISION_MODEL = 'google/gemini-3.5-flash'

type VisionContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }

type VisionMessage = { role: 'system' | 'user' | 'assistant'; content: string | VisionContentPart[] }

// OpenRouter's OpenAI-compatible chat completions endpoint (used by the raw
// fetch in callOpenRouterVision, which bypasses the AI SDK for multimodal input).
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Options for the raw vision call. `response_format` mirrors OpenRouter's
// optional JSON-mode payload (omitted by default — some vision models reject it).
type CallOptions = { temperature?: number; response_format?: Record<string, unknown> }

/**
 * Calls OpenRouter with a vision-capable model for multimodal image+text inputs.
 * Uses VISION_MODEL directly (no fallback — vision support is model-specific).
 */
export async function callOpenRouterVision(messages: VisionMessage[], options: CallOptions = {}): Promise<string> {
    const { temperature = 0.2, response_format } = options

    const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'fitrep',
        },
        body: JSON.stringify({
            model: VISION_MODEL,
            messages,
            temperature,
            ...(response_format ? { response_format } : {}),
        }),
    })
    if (!res.ok) {
        const body = await res.text().catch(() => '(no body)')
        throw Object.assign(new Error(`OpenRouter ${res.status}: ${body}`), { status: res.status })
    }
    const json = await res.json()
    let content: string = json.choices[0].message.content
    content = content.replace(/^```json?\n?([\s\S]*?)\n?```$/m, '$1').trim()
    return content
}
