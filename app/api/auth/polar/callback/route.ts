// app/api/auth/polar/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
    return NextResponse.redirect(new URL("/error", request.url));
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

    // Extract user ID from state parameter, with cookie fallback for resiliency.
    let userId = null;

    if (state) {
        try {
            userId = Buffer.from(state, "base64url").toString("utf-8");
        } catch (error) {
            try {
                userId = Buffer.from(state, "base64").toString("utf-8");
            } catch (fallbackError) {
                console.error("Error decoding state:", error, fallbackError);
            }
        }
    }

    if (!userId) {
        userId = request.cookies.get("polar_oauth_user_id")?.value ?? null;
    }

    if (!userId) {
        console.error("No user ID found in state parameter");
        return NextResponse.redirect(new URL("/error", request.url));
    }

    console.log(`Received tokens for user ${userId}:`, tokens);



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
        const exercisesResponse = await fetch('https://www.polaraccesslink.com/v3/exercises', {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: "application/json",
            }
        }).then(res => res.json());

        console.log(`Fetched exercises for user ${userId}:`, exercisesResponse);

        const dailyActivityResponse = await fetch('https://www.polaraccesslink.com/v3/users/activities', {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: "application/json",
            }
        }).then(res => res.json());

        console.log(`Fetched daily activity for user ${userId}:`, dailyActivityResponse);

        const nightlyRechargeResponse = await fetch('https://www.polaraccesslink.com/v3/users/nightly-recharge', {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: "application/json",
            }
        }).then(res => res.json());

        console.log(`Fetched nightly recharge for user ${userId}:`, nightlyRechargeResponse);

        const cardioLoadResponse = await fetch('https://www.polaraccesslink.com/v3/users/cardio-load', {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: "application/json",
            }
        }).then(res => res.json());

        console.log(`Fetched cardio load for user ${userId}:`, cardioLoadResponse);


    }

    console.log(`Successfully saved tokens for user ${userId}:`, tokens.access_token);

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.delete("polar_oauth_user_id");
    return response;
}
