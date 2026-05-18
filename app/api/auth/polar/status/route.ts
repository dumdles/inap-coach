import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/app/api/cron/_lib"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")?.trim()

    if (!userId) {
        return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
        .from("polar_tokens")
        .select("user_id, access_token")
        .eq("user_id", userId)
        .maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        connected: Boolean(data?.access_token),
    })
}