import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/app/api/cron/_lib"
import { verifyAuth } from "@/app/api/_lib/auth"

// GET /api/auth/polar/status — is the caller's Polar account connected?
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request)
    if (auth.error) return auth.error

    const { data, error } = await supabaseAdmin
        .from("polar_tokens")
        .select("user_id, access_token")
        .eq("user_id", auth.user.id)
        .maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        connected: Boolean(data?.access_token),
    })
}
