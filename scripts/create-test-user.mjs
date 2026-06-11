// One-off helper: creates (or resets) a disposable test cadet for local
// end-to-end testing of the AI coach chat. Safe to re-run.
//   node scripts/create-test-user.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = 'coach-e2e-test@fitrep.local'
const PASSWORD = 'CoachTest!2026'

// Find-or-create the auth user
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
let authUser = list.users.find(u => u.email === EMAIL)
if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
        email: EMAIL, password: PASSWORD, email_confirm: true,
    })
    if (error) throw error
    authUser = data.user
} else {
    await admin.auth.admin.updateUserById(authUser.id, { password: PASSWORD })
}

// users.wing is NOT NULL and references ocs_wings — grab the first real wing
const { data: wings } = await admin.from('ocs_wings').select('name').limit(1)

// Upsert the app profile row
const { error: upsertErr } = await admin.from('users').upsert({
    id: authUser.id,
    username: 'coach_e2e_test',
    email: EMAIL,
    full_name: 'Testy Tan',
    rank: 'OCT',
    gender: 'Male',
    date_of_birth: '2004-03-15',
    height_cm: 175,
    weight_kg: 70,
    activity_level: 'active',
    goal_mode: 'maintain',
    service: 'Army',
    wing: wings?.[0]?.name,
    calorie_target: 2800,
}, { onConflict: 'id' })
if (upsertErr) throw upsertErr

// Seed a little data so tools have something to return
const today = new Date()
const d = (offset) => new Date(today.getTime() - offset * 86400_000).toISOString().slice(0, 10)
await admin.from('daily_summaries').upsert(
    [1, 2, 3, 4, 5].map(i => ({
        user_id: authUser.id, date: d(i),
        total_calories: 2400 + i * 60, total_protein_g: 120 + i * 4,
        total_carbs_g: 280, total_fat_g: 75, calorie_target: 2800,
    })), { onConflict: 'user_id,date', ignoreDuplicates: true },
).then(r => r.error && console.warn('summaries:', r.error.message))

console.log('Test user ready:', authUser.id)
console.log('email:', EMAIL)
