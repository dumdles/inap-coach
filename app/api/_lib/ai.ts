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
