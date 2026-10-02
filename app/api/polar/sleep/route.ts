import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/app/api/_lib/auth'
import { syncPolarSleep } from '@/app/api/_lib/polar-sleep'

// GET /api/polar/sleep — sync the caller's Polar sleep into sleep_logs.
// Logic lives in app/api/_lib/polar-sleep.ts.
export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const result = await syncPolarSleep(auth.user.id)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json(result)
}
