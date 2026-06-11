// Runs daily at 0700 SGT.
// Sends one nutrition tip to users who opted in.
// Users with a known service branch receive a service-specific tip ~40% of the time;
// the remaining 60% (and all tips for users without a service) come from the DB pool.
// Avoids repeating the same tip within 30 days.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, guardCron, insertNotif, sgTime } from '../_lib'

export const runtime = 'nodejs'

// ── Service-specific tip pools ────────────────────────────────────────────────
// Each array has ~6 tips so there is enough variety to avoid near-term repeats.

const SERVICE_TIPS: Record<string, { title: string; content: string }[]> = {
    Army: [
        {
            title: 'Carb-load before route marches',
            content: 'Complex carbs 2–3 hours before a route march top up your muscle glycogen stores — the primary fuel that carries you through long distances under load. Rice, oats, or wholegrain bread are ideal.',
        },
        {
            title: 'Replace sodium after sweating',
            content: 'Route marches and field exercises cause significant sodium loss through sweat. A salty snack or a pinch of salt in your water bottle post-march helps restore electrolyte balance and prevents cramping.',
        },
        {
            title: 'Hit protein fast after training',
            content: 'Heavy field loads stress your muscles significantly. Aim for 30–40 g of protein within 45 minutes of finishing training — this is the window where muscle repair is most efficient.',
        },
        {
            title: 'Army training needs ~200 extra kcal/day',
            content: 'Route marches and obstacle courses burn roughly 200–300 more calories daily than other services at the same activity level. Under-fuelling slows recovery and raises injury risk — don\'t shortchange yourself.',
        },
        {
            title: 'Keep protein high on rest days too',
            content: 'After intense field exercises, your body continues repairing muscle even on rest days. Maintain high protein intake even when physical activity drops — this is when muscle is actually being built.',
        },
        {
            title: 'Fuel explosive power with carbs and creatine-rich foods',
            content: 'Obstacle courses and live-firing drills demand explosive power. Consistent carb intake and creatine-rich foods (red meat, fish) support this type of high-intensity training.',
        },
    ],
    Navy: [
        {
            title: 'Hydrate before you enter the pool',
            content: 'Swimming causes significant fluid loss even though you\'re surrounded by water. Dehydration impairs swim performance noticeably — drink at least 500 ml before pool sessions and replenish well after.',
        },
        {
            title: 'Replace electrolytes after swim training',
            content: 'Pool and sea sessions deplete sodium, potassium, and magnesium. Bananas, coconut water, or a salted post-training snack all help restore electrolyte balance and prevent fatigue.',
        },
        {
            title: 'Periodise carbs around your swim days',
            content: 'Your aerobic endurance training responds well to carb periodisation — slightly higher carb intake on heavy swim days supports performance; slightly lower on rest days reduces unnecessary calorie surplus.',
        },
        {
            title: 'Support your breathing with antioxidants',
            content: 'Pool chlorine can irritate airways and increase breathing effort during training. Antioxidant-rich foods like berries, leafy greens, and citrus fruits help support respiratory health.',
        },
        {
            title: 'Iron supports your VO₂ performance',
            content: 'Aerobic endurance training relies on efficient oxygen transport — and iron is the key mineral for that. Leafy greens, lean red meat, and legumes are good sources; pair with vitamin C to improve absorption.',
        },
        {
            title: 'Light, balanced pre-swim meals work best',
            content: 'Avoid heavy protein-only meals before swim sessions. A mix of easily-digested carbs and moderate protein 1–2 hours before gives you energy without the risk of cramping mid-pool.',
        },
    ],
    'Air Force': [
        {
            title: 'Eat within 30 minutes of finishing training',
            content: 'Precision conditioning and HIIT sessions respond well to immediate post-workout nutrition. A carb-protein meal or snack within 30 minutes after training supports recovery and accelerates adaptation.',
        },
        {
            title: 'Steady blood glucose = steady performance',
            content: 'Complex carbs at each main meal prevent the energy crashes that affect both mental focus and physical output during training. White rice is fine — add vegetables and protein to slow glucose absorption.',
        },
        {
            title: 'Recover faster with a 3:1 carb-to-protein snack',
            content: 'HIIT cycles deplete muscle glycogen rapidly. A post-session snack like rice with eggs (3:1 carb-to-protein ratio) is a well-studied formula for optimising glycogen resynthesis.',
        },
        {
            title: 'Don\'t cut carbs below 40% of daily intake',
            content: 'Your aerobic base training makes your body efficient at using fat for fuel — but peak performance still requires carbohydrates. Dropping below 40% of daily calories from carbs will blunt performance.',
        },
        {
            title: 'Sleep and nutrition work together for recovery',
            content: 'Adequate sleep and nutrition are inseparable for Air Force training. A small protein-carb snack before bed (e.g. milk and oats) supports overnight muscle recovery and improves sleep quality.',
        },
        {
            title: 'Time caffeine 30–60 min before training',
            content: 'Caffeine is well-evidenced to enhance aerobic performance. 200–400 mg (roughly 2–4 cups of coffee) taken 30–60 minutes before training is the evidence-backed sweet spot for endurance benefit.',
        },
    ],
    DIS: [
        {
            title: 'Complex carbs keep your focus sharp',
            content: 'Cognitive performance peaks when blood glucose is stable. Choose complex carbs over refined ones — brown rice, wholegrain bread, sweet potato — to avoid the energy crashes that impair focus and decision-making.',
        },
        {
            title: 'Omega-3s support brain function',
            content: 'Omega-3 fatty acids support memory, focus, and information processing. Aim for fatty fish (salmon, sardines, mackerel) 2–3 times a week — or consider a fish oil supplement if your intake is low.',
        },
        {
            title: 'Even mild dehydration impairs cognition',
            content: 'Just 1–2% dehydration measurably reduces reaction time, short-term memory, and decision accuracy. Drink consistently throughout the day — don\'t wait until you\'re thirsty.',
        },
        {
            title: 'Micronutrients matter as much as macros for DIS',
            content: 'Zinc (nuts, seeds, red meat), magnesium (leafy greens, dark chocolate), and B-vitamins (eggs, whole grains) are all essential for neurological function and sustained mental performance.',
        },
        {
            title: 'Good sleep is your brain\'s recovery mode',
            content: 'Logging sleep in FitRep helps track whether your nutrition is supporting sleep quality. Protein and magnesium before bed are both associated with deeper, more restorative sleep.',
        },
        {
            title: 'Cycle your caffeine intake',
            content: 'Caffeine dependency increases anxiety and degrades sleep quality over time. Try to have caffeine-free days weekly to maintain sensitivity and avoid the withdrawal headaches that cloud your thinking.',
        },
    ],
}

export async function GET(req: NextRequest) {
    const guard = guardCron(req)
    if (guard) return guard

    const { data: tips } = await supabaseAdmin
        .from('nutrition_tips')
        .select('id, title, content')
        .eq('is_active', true)

    if (!tips?.length) return NextResponse.json({ sent: 0, reason: 'no active tips' })

    // Fetch users who opted in for tips, including their service for targeted tips
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, notif_prefs, service')
        .not('notif_prefs', 'is', null)

    const eligible = (users ?? []).filter(u => u.notif_prefs?.tips === true)
    if (!eligible.length) return NextResponse.json({ sent: 0 })

    // Find tips sent in the last 30 days per user to avoid repeats
    const thirtyDaysAgo = new Date(sgTime())
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentNotifs } = await supabaseAdmin
        .from('notifications')
        .select('user_id, body')
        .eq('type', 'nutrition_tip')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .in('user_id', eligible.map(u => u.id))

    // Map userId → set of recently seen tip bodies to avoid repeats
    const recentByUser = new Map<string, Set<string>>()
    for (const n of recentNotifs ?? []) {
        const s = recentByUser.get(n.user_id) ?? new Set()
        s.add(n.body ?? '')
        recentByUser.set(n.user_id, s)
    }

    function pickTip(userId: string, service: string | null) {
        const seen = recentByUser.get(userId) ?? new Set()

        // 40% chance of a service-specific tip when the user has a known service with tips
        const serviceTips = service ? (SERVICE_TIPS[service] ?? []) : []
        const useServiceTip = serviceTips.length > 0 && Math.random() < 0.4

        if (useServiceTip) {
            const unseenService = serviceTips.filter(t => !seen.has(t.content))
            const pool = unseenService.length > 0 ? unseenService : serviceTips
            return pool[Math.floor(Math.random() * pool.length)]
        }

        // Fall back to generic DB tips
        const unseen = tips!.filter(t => !seen.has(t.content))
        const pool = unseen.length > 0 ? unseen : tips!
        return pool[Math.floor(Math.random() * pool.length)]
    }

    const inserts = eligible.map(u => {
        const tip = pickTip(u.id, u.service ?? null)
        return insertNotif(u.id, 'nutrition_tip', `💡 ${tip.title}`, tip.content)
    })

    await Promise.all(inserts)
    return NextResponse.json({ sent: inserts.length })
}
