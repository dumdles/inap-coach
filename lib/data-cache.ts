import { mutate } from 'swr'

// Helpers for the shared client-side data cache (SWR). Kept separate from
// lib/use-data.ts so auth-context can import it without a circular import.

/**
 * Drop every cached response. Called on sign-out so the next person on a shared
 * phone never sees the previous cadet's data, even for a moment.
 */
export function clearDataCache() {
    return mutate(() => true, undefined, { revalidate: false })
}

/**
 * Re-fetch every cached query whose name/path starts with `prefix` (in the
 * background — screens keep showing the old data until the new data arrives).
 * Use after a write that other screens display, e.g. refreshData('/api/leaderboard')
 * or refreshData('meals:') after logging a meal.
 */
export function refreshData(prefix: string) {
    // Pass ONLY the key filter: SWR then re-fetches and keeps showing the current
    // data. Passing a data argument — even `undefined` — would overwrite the cache
    // with it first, blanking every matching screen back to its skeleton.
    return mutate(key => Array.isArray(key) && typeof key[2] === 'string' && key[2].startsWith(prefix))
}
