import { NextRequest, NextResponse } from "next/server";
import { fetchPolar } from "@/lib/polar";

export async function GET(request: NextRequest) {
    try {
        const searchParams = new URL(request.url).searchParams;
        const userId = searchParams.get("userId");
        const endpoint = searchParams.get("endpoint") || "/users/exercises";

        if (!userId) {
            return NextResponse.json(
                { error: "Missing userId parameter" },
                { status: 400 }
            );
        }

        let data: unknown;
        try {
            data = await fetchPolar(userId, endpoint);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (msg.includes("status 404")) {
                return NextResponse.json({ exercises: [] });
            }
            throw err;
        }
        return NextResponse.json(data);
    } catch (error) {
        console.error("Polar API error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
