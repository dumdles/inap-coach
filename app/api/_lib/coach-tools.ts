// Tool definitions for the AI coach chat. Each tool wraps a scoped query from
// coach-data.ts with the authed cadet's userId baked in, so the model can
// request data but never choose whose data it sees.

import { tool } from 'ai'
import { z } from 'zod'
import {
    getNutritionSummary, getMealsForDate, getWorkouts, getWeightTrend,
    getSleep, getLeaderboard, getIpptResults, getTargets,
} from './coach-data'

const daysSchema = z.number().int().min(1).max(90).default(14)
    .describe('How many days back to look (default 14)')

export function buildCoachTools(userId: string) {
    return {
        getNutritionSummary: tool({
            description: "Daily calorie/macro totals vs target for the cadet's recent days, with averages, adherence %, and trend. Use for questions about eating habits, calories, protein, or macro balance.",
            inputSchema: z.object({ days: daysSchema }),
            execute: async ({ days }) => getNutritionSummary(userId, days),
        }),
        getMeals: tool({
            description: 'The individual meals the cadet logged on one specific date (food names, portions, macros). Use for "what did I eat on …" questions.',
            inputSchema: z.object({
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date in YYYY-MM-DD'),
            }),
            execute: async ({ date }) => getMealsForDate(userId, date),
        }),
        getWorkouts: tool({
            description: "The cadet's recent workouts (manual + Polar watch imports) with volume totals and per-sport breakdown.",
            inputSchema: z.object({ days: daysSchema }),
            execute: async ({ days }) => getWorkouts(userId, days),
        }),
        getWeightTrend: tool({
            description: "The cadet's weight and body-fat logs with overall change, weekly trend, and their weight goal.",
            inputSchema: z.object({ days: daysSchema.default(30) }),
            execute: async ({ days }) => getWeightTrend(userId, days),
        }),
        getSleep: tool({
            description: "The cadet's sleep logs (duration, sleep score, deep/REM, HRV) with averages and trend. Use for recovery and sleep questions.",
            inputSchema: z.object({ days: daysSchema }),
            execute: async ({ days }) => getSleep(userId, days),
        }),
        getLeaderboard: tool({
            description: "The cadet's recent weekly leaderboard scores (consistency + improvement points).",
            inputSchema: z.object({}),
            execute: async () => getLeaderboard(userId),
        }),
        getIpptResults: tool({
            description: "The cadet's past IPPT results and upcoming IPPT date. Use for IPPT prep questions.",
            inputSchema: z.object({}),
            execute: async () => getIpptResults(userId),
        }),
        getTargets: tool({
            description: "The cadet's recommended daily calorie and protein targets computed from their profile (TDEE), alongside their currently set target.",
            inputSchema: z.object({}),
            execute: async () => getTargets(userId),
        }),
    }
}
