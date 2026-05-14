// Runs daily at 2100 SGT.
// Notifies users whose logged protein for today is < 80% of their target.
// Protein target = 30% of calorie_target (or TDEE estimate) ÷ 4 kcal/g.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, guardCron, insertNotif, sgTime } from '../_lib'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
    const guard = guardCron(req)
    if (guard) return guard

    const today = sgTime().toISOString().slice(0, 10)

    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, notif_prefs, calorie_target, weight_kg, height_cm, date_of_birth, gender, activity_level')
        .not('notif_prefs', 'is', null)

    const eligible = (users ?? []).filter(u => u.notif_prefs?.macro_alerts !== false)

    const { data: summaries } = await supabaseAdmin
        .from('daily_summaries')
        .select('user_id, total_protein_g')
        .eq('date', today)

    const proteinMap = new Map((summaries ?? []).map(s => [s.user_id, s.total_protein_g ?? 0]))

    type UserRow = NonNullable<typeof users>[number]
    function proteinTarget(u: UserRow): number {
        const cal = u.calorie_target ?? estimateTDEE(u)
        return Math.round((cal * 0.30) / 4)
    }

    function estimateTDEE(u: UserRow): number {
        const w = u.weight_kg ?? 70
        const h = u.height_cm ?? 170
        const age = u.date_of_birth
            ? new Date().getFullYear() - new Date(u.date_of_birth).getFullYear()
            : 22
        const isFemale = u.gender?.toLowerCase() === 'female'
        const bmr = isFemale
            ? 10 * w + 6.25 * h - 5 * age - 161
            : 10 * w + 6.25 * h - 5 * age + 5
        return Math.round(bmr * 1.55)
    }

    const inserts = eligible
        .filter(u => {
            const logged = proteinMap.get(u.id) ?? 0
            const target = proteinTarget(u)
            return logged < target * 0.8
        })
        .map(u => {
            const logged = Math.round(proteinMap.get(u.id) ?? 0)
            const target = proteinTarget(u)
            const gap = target - logged
            return insertNotif(
                u.id,
                'macro_alert',
                '💪 Protein falling behind',
                `You're ${gap}g short of your ${target}g protein target today. Consider a high-protein snack.`,
            )
        })

    await Promise.all(inserts)
    return NextResponse.json({ sent: inserts.length })
}
