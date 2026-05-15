import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();

    if (!userId) {
        return NextResponse.redirect(new URL("/dashboard/workouts?polarError=missing-user", request.url));
    }

    const state = Buffer.from(userId, "utf-8").toString("base64url");

    const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.POLAR_CLIENT_ID!,
        redirect_uri: process.env.POLAR_REDIRECT_URI!,
        scope: "accesslink.read_all",
        state,
    });

    const url = `https://flow.polar.com/oauth2/authorization?${params}`;

    const response = NextResponse.redirect(url);
    response.cookies.set("polar_oauth_user_id", userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 10,
    });

    return response;
}
