// lib/polar.ts

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
        throw new Error("Missing Supabase environment variables");
    }

    return createClient(supabaseUrl, supabaseSecretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function getPolarToken(userId: string) {
    const supabase = getSupabaseAdminClient();

    console.log(`Fetching Polar token for user: ${userId}`);

    const { data, error } = await supabase
        .from("polar_tokens")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to retrieve Polar token: ${error.message}`);
    }

    if (!data) {
        throw new Error(`No Polar token found for user ${userId}. Please connect to Polar first.`);
    }

    if (!data.access_token) {
        throw new Error("Polar token exists but access_token is missing");
    }

    console.log(`Successfully retrieved Polar token for user: ${userId}`);
    return data.access_token;
}

export async function fetchPolar(userId: string, endpoint: string) {
    const accessToken = await getPolarToken(userId);
    console.log(`Calling Polar API endpoint: ${endpoint}`);

    const res = await fetch(`https://www.polaraccesslink.com/v3${endpoint}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        },
    });

    const responseText = await res.text();
    console.log(`Polar API response status: ${res.status}`);
    console.log(`Polar API response:`, responseText);

    // 204 No Content means no new data — return null so callers can handle gracefully
    if (res.status === 204) return null;

    if (!res.ok) {
        throw new Error(`Polar API request failed with status ${res.status}: ${responseText}`);
    }

    try {
        return JSON.parse(responseText);
    } catch {
        return responseText;
    }
}
