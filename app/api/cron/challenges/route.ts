import { NextRequest, NextResponse } from 'next/server'
import { guardCron } from '@/app/api/cron/_lib'
import { finalizeAllDue } from '@/app/api/_lib/challenges'

// GET /api/cron/challenges — pay out challenges that have ended.
// Also happens lazily whenever someone opens the Challenges page, so this cron
// only makes sure winners are notified promptly even if nobody visits.
export async function GET(req: NextRequest) {
    const denied = guardCron(req)
    if (denied) return denied
    const finalized = await finalizeAllDue()
    return NextResponse.json({ finalized })
}
