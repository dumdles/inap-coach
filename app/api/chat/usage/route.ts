import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/app/api/_lib/auth'
import { getAiQuota } from '@/app/api/_lib/ai-usage'

// GET /api/chat/usage — the authed cadet's AI coach usage for today, so the
// chat UI can show how many messages they have left and pre-empt the limit.
export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req)
    if ('error' in auth) return auth.error

    const quota = await getAiQuota(auth.user.id)
    return NextResponse.json(quota)
}
