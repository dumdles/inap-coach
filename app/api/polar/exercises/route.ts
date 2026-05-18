import { NextRequest, NextResponse } from "next/server";
import { fetchPolar } from "@/lib/polar";
import { parseDuration } from "@/lib/utils";
import { supabaseAdmin } from "@/app/api/cron/_lib";

// Normalize Polar sport names: "TRAIL_RUNNING" → "Trail running"
function normalisePolarName(raw: string): string {
    return raw.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = new URL(request.url).searchParams;
        const userId = searchParams.get("userId");
        const endpoint = searchParams.get("endpoint") || "/exercises";

        if (!userId) {
            return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
        }

        let data: unknown;
        try {
            data = await fetchPolar(userId, endpoint);

            const exercises = (data as any)?.exercises ?? data;

            if (exercises && exercises.length > 0) {
                // Upsert all exercise metadata — includes has_route so we know which ones carry GPS
                const { error } = await supabaseAdmin.from("workout_logs").upsert(
                    exercises.map((exercise: any) => ({
                        user_id: userId,
                        source: "polar",
                        polar_exercise_id: exercise.id,
                        name: normalisePolarName(exercise.detailed_sport_info ?? exercise.sport ?? "Polar Workout"),
                        duration_min: exercise.duration
                            ? Math.round(parseDuration(exercise.duration) / 60)
                            : null,
                        calories: exercise.calories ?? null,
                        distance_km: exercise.distance ? exercise.distance / 1000 : null,
                        heart_rate_avg: exercise.heart_rate?.average ?? null,
                        heart_rate_max: exercise.heart_rate?.maximum ?? null,
                        sport: exercise.sport ?? null,
                        detailed_sport_info: exercise.detailed_sport_info ?? null,
                        fat_percentage: exercise.fat_percentage ?? null,
                        carbohydrate_percentage: exercise.carbohydrate_percentage ?? null,
                        protein_percentage: exercise.protein_percentage ?? null,
                        training_load: exercise.training_load ?? null,
                        heart_rate_zones: exercise.heart_rate_zones ?? null,
                        start_time: exercise.start_time ?? null,
                        start_time_utc_offset: exercise.start_time_utc_offset ?? null,
                        device: exercise.device ?? null,
                        logged_at: exercise.upload_time ?? new Date().toISOString(),
                        has_route: exercise.has_route ?? false,
                    })),
                    { onConflict: "user_id, polar_exercise_id" }
                );

                if (error) {
                    console.error("Upsert error:", error);
                } else {
                    // Fetch and cache GPX for exercises that have a GPS route
                    const routeExercises = exercises.filter((e: any) => e.has_route && e.id);
                    if (routeExercises.length > 0) {
                        await Promise.allSettled(
                            routeExercises.map(async (exercise: any) => {
                                try {
                                    // Check if GPX is already cached to avoid redundant API calls
                                    const { data: existing } = await supabaseAdmin
                                        .from("workout_logs")
                                        .select("gpx")
                                        .eq("user_id", userId)
                                        .eq("polar_exercise_id", exercise.id)
                                        .single();

                                    if (existing?.gpx) return; // already cached

                                    const gpx = await fetchPolar(userId, `/exercises/${exercise.id}/gpx`);
                                    if (typeof gpx !== "string" || !gpx) return;

                                    await supabaseAdmin
                                        .from("workout_logs")
                                        .update({ gpx })
                                        .eq("user_id", userId)
                                        .eq("polar_exercise_id", exercise.id);
                                } catch {
                                    // GPS fetch failures are non-fatal — skip silently
                                }
                            })
                        );
                    }
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (msg.includes("status 404")) {
                return NextResponse.json({ exercises: [] });
            }
            throw err;
        }

        if (data === null) return NextResponse.json({ exercises: [] });
        return NextResponse.json(data);
    } catch (error) {
        console.error("Polar API error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
