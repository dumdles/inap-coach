'use client'

import useSWR, { type SWRConfiguration } from 'swr'
import { useAuth } from '@/app/context/auth-context'
import { authFetch } from '@/lib/auth-fetch'

// ── Client-side data cache ────────────────────────────────────────────────────
// Every dashboard page used to fetch its data from scratch each time it opened,
// so navigating Home → Wing → Home showed the skeletons twice. These hooks wrap
// SWR ("stale-while-revalidate"): the first visit fetches as before; later
// visits render the cached data instantly and quietly refresh it in the
// background, swapping in the new data when it arrives.
//
//   const { data, isLoading, mutate } = useApi<Entry[]>('/api/leaderboard?scope=wing')
//   const { data } = useData(`meals:home:${day}`, async uid => { …supabase query… })
//
// - `isLoading` is only true when there is nothing cached yet → show the skeleton.
// - `mutate()` re-fetches (call after a write on the same page);
//   `refreshData(prefix)` from lib/data-cache.ts re-fetches matching queries anywhere.
// - Cache keys include the signed-in user's id, and the cache is cleared on
//   sign-out (auth-context), so cadets never see each other's data.
// - The cache lives in memory for the browser tab; a full page reload starts fresh.

export class ApiError extends Error {
    constructor(message: string, public status: number) { super(message) }
}

/** Shared defaults: collapse identical requests made within 2s (e.g. two cards
 *  mounting together), and refresh on tab focus at most once a minute. Every
 *  time a page opens it still re-checks in the background, so data written on
 *  another page shows up on return. */
const DEFAULTS: SWRConfiguration = {
    dedupingInterval: 2_000,
    focusThrottleInterval: 60_000,
    errorRetryCount: 2,
    // A 4xx (forbidden, not found…) won't fix itself — only retry network/server errors.
    shouldRetryOnError: err => !(err instanceof ApiError && err.status >= 400 && err.status < 500),
}

/** GET one of our /api routes with the Bearer token; throws ApiError on a non-2xx. */
export async function apiGet<T>(path: string): Promise<T> {
    const res = await authFetch(path)
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(json?.error ?? `Request failed (${res.status})`, res.status)
    return json as T
}

/** Cached GET of an /api route. Pass `null` to wait (e.g. until a profile has loaded). */
export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
    const { user } = useAuth()
    return useSWR<T>(
        user && path ? ['api', user.id, path] : null,
        () => apiGet<T>(path!),
        { ...DEFAULTS, ...config },
    )
}

/**
 * Cached result of any async loader — typically a direct Supabase query.
 * `name` identifies the query: `<entity>:<screen>:<params>`, e.g. `meals:home:2026-10-03`.
 * The same name must always return the same shape, hence the screen part; the
 * entity prefix lets `refreshData('meals:')` refresh every meal query after a write.
 * Include anything the query depends on (dates, ids). Pass `null` to wait. The loader gets the signed-in user's id
 * and should throw on error so SWR can retry:
 *
 *   useData(`meals:home:${day}`, async uid => {
 *       const { data, error } = await supabase.from('meal_logs')…eq('user_id', uid)
 *       if (error) throw error
 *       return data
 *   })
 */
export function useData<T>(name: string | null, load: (userId: string) => Promise<T>, config?: SWRConfiguration<T>) {
    const { user } = useAuth()
    return useSWR<T>(
        user && name ? ['data', user.id, name] : null,
        () => load(user!.id),
        { ...DEFAULTS, ...config },
    )
}
