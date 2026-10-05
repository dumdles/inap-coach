import { createHmac, timingSafeEqual } from 'crypto'

// Signed OAuth `state` for the Polar connect flow.
//
// The state carries which FitRep user is connecting. It used to be the bare
// base64 user id, which anyone could forge to attach their Polar account to
// another cadet. Now it is `<userId>.<expiresAt>.<hmac>`, signed with
// POLAR_CLIENT_SECRET (server-only), and the callback rejects anything that
// doesn't verify or has expired.

const TTL_MS = 10 * 60 * 1000 // must finish connecting within 10 minutes

function sign(payload: string) {
    const secret = process.env.POLAR_CLIENT_SECRET
    if (!secret) throw new Error('POLAR_CLIENT_SECRET is not set')
    return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createPolarState(userId: string): string {
    const payload = `${userId}.${Date.now() + TTL_MS}`
    return `${payload}.${sign(payload)}`
}

/** Returns the user id if the state is authentic and unexpired, else null. */
export function verifyPolarState(state: string | null): string | null {
    if (!state) return null
    const parts = state.split('.')
    if (parts.length !== 3) return null
    const [userId, expires, mac] = parts
    const expected = sign(`${userId}.${expires}`)
    const a = Buffer.from(mac), b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    if (!(Number(expires) > Date.now())) return null
    return userId
}
