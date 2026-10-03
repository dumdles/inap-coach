// app/api/auth/polar/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPolarState } from "@/app/api/_lib/polar-state";
import { syncPolarSleep } from "@/app/api/_lib/polar-sleep";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
    return NextResponse.redirect(new URL("/error", request.url));
    }

    // Which FitRep user started this? Only trust a state we signed (see
    // app/api/_lib/polar-state.ts) — checked before spending the code.
    const userId = verifyPolarState(state);
    if (!userId) {
        console.error("Polar callback: invalid or expired state");
        return NextResponse.redirect(new URL("/dashboard/workouts?polarError=invalid-state", request.url));
    }

  // Exchange the authorization code for an access token
    const tokenRes = await fetch("https://polarremote.com/v2/oauth2/token", {
    method: "POST",
    headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
        "Basic " +
        Buffer.from(
        `${process.env.POLAR_CLIENT_ID}:${process.env.POLAR_CLIENT_SECRET}`,
        ).toString("base64"),
    },
    body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.POLAR_REDIRECT_URI!,
    }),
    });

    const tokens = await tokenRes.json();




    // Save tokens to Supabase (linked to the user ID from state)
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await supabaseAdmin.from("polar_tokens").upsert(
        {
            user_id: userId,
            access_token: tokens.access_token,
            x_user_id: tokens.x_user_id,
            expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        },
        { onConflict: "user_id" }
    );

    if (error) {
        console.error("Error saving tokens to Supabase:", error);
        return NextResponse.redirect(new URL("/error", request.url));
    } else {
        await fetch("https://www.polaraccesslink.com/v3/users", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ "member-id": tokens.x_user_id.toString() }),
});

        const dailyActivityResponse = await fetch('https://www.polaraccesslink.com/v3/users/activities', {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: "application/json",
            }
        }).then(res => res.json());

        console.log(`Fetched daily activity for user ${userId}:`, dailyActivityResponse?.length ?? 0, 'entries');

        // First sleep sync — called directly; /api/polar/sleep needs the user's Bearer token.
        await syncPolarSleep(userId);

        // const cardioLoadResponse = await fetch('https://www.polaraccesslink.com/v3/users/cardio-load', {
        //     method: "GET",
        //     headers: {
        //         Authorization: `Bearer ${tokens.access_token}`,
        //         Accept: "application/json",
        //     }
        // }).then(res => res.json());

        // console.log(`Fetched cardio load for user ${userId}:`, cardioLoadResponse);


    }

    console.log(`Saved Polar tokens for user ${userId}`);

    const response = NextResponse.redirect(new URL("/dashboard/workouts", request.url));
    return response;
}
