/**
 * PostgREST (Supabase's REST layer) returns at most 1000 rows per request and
 * silently drops the rest. Use this for any query that could exceed that:
 * it keeps requesting the next 1000-row page until a short page comes back.
 *
 *   const users = await fetchPaged<User>((from, to) =>
 *       supabaseAdmin.from('users').select('id, wing').order('id').range(from, to))
 *
 * Always add an .order() on a unique column so pages don't overlap or skip rows.
 */
export const PAGE = 1000

export async function fetchPaged<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
    const rows: T[] = []
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        const page = (data ?? []) as T[]
        rows.push(...page)
        if (page.length < PAGE) return rows
    }
}
