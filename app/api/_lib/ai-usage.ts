// Daily AI usage limiting for the coach. Each cadet gets a fixed number of AI
// coach messages per Singapore day; this module owns the count-and-check.
//
// The actual increment is atomic in Postgres (see the increment_ai_usage
// function) so concurrent requests can't slip past the cap.

import { supabaseAdmin } from '@/app/api/cron/_lib'

/** Daily coach-message cap per cadet. Override with AI_DAILY_MESSAGE_LIMIT. */
export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_MESSAGE_LIMIT ?? 25)

/** Today's date in Singapore time as YYYY-MM-DD (the app's reference tz). */
export function sgtDateString(): string {
    // en-CA formats as YYYY-MM-DD, which is exactly the shape Postgres wants.
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date())
}

export type QuotaResult = { allowed: boolean; used: number; limit: number; remaining: number }

/**
 * Atomically consume one unit of a cadet's daily AI quota. Returns whether the
 * request is allowed and how much of the quota is now used. Fails OPEN — if the
 * limiter itself errors we let the request through rather than blocking the
 * cadet on an infrastructure hiccup.
 */
export async function consumeAiQuota(userId: string, limit = AI_DAILY_LIMIT): Promise<QuotaResult> {
    const { data, error } = await supabaseAdmin.rpc('increment_ai_usage', {
        p_user_id: userId,
        p_date: sgtDateString(),
        p_limit: limit,
    })
    if (error) {
        console.error('[ai-usage] increment failed, failing open:', error)
        return { allowed: true, used: 0, limit, remaining: limit }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; used: number } | undefined
    const used = row?.used ?? 0
    return { allowed: row?.allowed ?? true, used, limit, remaining: Math.max(0, limit - used) }
}

/** Read a cadet's current usage for today without consuming any quota. */
export async function getAiQuota(userId: string, limit = AI_DAILY_LIMIT): Promise<QuotaResult> {
    const { data } = await supabaseAdmin
        .from('ai_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('usage_date', sgtDateString())
        .maybeSingle()
    const used = data?.count ?? 0
    return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) }
}
