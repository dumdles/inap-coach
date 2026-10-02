import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/api/_lib/auth";
import { createPolarState } from "@/app/api/_lib/polar-state";

// POST /api/auth/polar — start connecting the caller's Polar account.
// Returns { url } for the Polar authorize page; the client then navigates there
// (a plain browser redirect can't carry the Bearer token, hence POST + JSON).
// The OAuth state is signed so the callback knows which user really started it.
export async function POST(request: NextRequest) {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.error;

    const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.POLAR_CLIENT_ID!,
        redirect_uri: process.env.POLAR_REDIRECT_URI!,
        scope: "accesslink.read_all",
        state: createPolarState(auth.user.id),
    });

    return NextResponse.json({ url: `https://flow.polar.com/oauth2/authorization?${params}` });
}
