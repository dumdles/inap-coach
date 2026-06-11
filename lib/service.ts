// Shared service constants and utilities for the four SAF services at OCS.
// Service is always derived from wing assignment — cadets cannot change it directly.
// Used across TDEE calculations, AI insights, UI badges, and push notifications.

export type SAFService = 'Army' | 'Navy' | 'Air Force' | 'DIS'

// Derives the service branch from a cadet's wing name.
// MIDS and Air wings map to Navy and Air Force; DIS Wing maps to DIS;
// everything else is an Army wing.
export function wingToService(wing: string): string {
    const w = (wing ?? '').toUpperCase()
    if (w.includes('MIDS')) return 'Navy'
    if (w.includes('AIR')) return 'Air Force'
    if (w.includes('DIS')) return 'DIS'
    return 'Army'
}

// Tailwind-based badge styling per service, matching actual SAF service colours.
// Army → green  |  Air Force → light blue  |  Navy → dark navy blue  |  DIS → orange on grey
export const SERVICE_META: Record<string, {
    label: string
    bg: string
    text: string
    border: string
}> = {
    'Army':      { label: 'Army',      bg: 'bg-green-600/10',  text: 'text-green-700 dark:text-green-500',   border: 'border-green-600/25' },
    'Navy':      { label: 'Navy',      bg: 'bg-blue-900/10',   text: 'text-blue-900 dark:text-blue-200',     border: 'border-blue-900/25' },
    'Air Force': { label: 'Air Force', bg: 'bg-sky-500/10',    text: 'text-sky-600 dark:text-sky-400',       border: 'border-sky-500/25' },
    'DIS':       { label: 'DIS',       bg: 'bg-zinc-500/10',   text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/25' },
}

// Additional daily calorie offset applied on top of the standard TDEE formula.
// Army cadets doing route marches and heavy field exercises burn significantly
// more than the generic activity multiplier accounts for at the same level.
// DIS cadets have a lower physical output than the moderate multiplier assumes.
export const SERVICE_CALORIE_OFFSET: Record<string, number> = {
    'Army':      200,
    'Navy':      0,
    'Air Force': 0,
    'DIS':      -100,
}

// Extra protein per kg of bodyweight added on top of the goal-mode multiplier.
// Army training causes more muscle fibre damage; DIS has lower physical demand.
export const SERVICE_PROTEIN_BOOST: Record<string, number> = {
    'Army':      0.2,
    'Navy':      0.1,
    'Air Force': 0.1,
    'DIS':       0,
}

// The goal mode best suited for each service, shown as a hint in settings.
export const SERVICE_GOAL_RECOMMENDATION: Record<string, {
    goalMode: string
    reason: string
}> = {
    'Army':      { goalMode: 'ippt',     reason: 'Supports intense physical demands of Army training' },
    'Navy':      { goalMode: 'maintain', reason: 'Balances swim fitness with strength endurance' },
    'Air Force': { goalMode: 'maintain', reason: 'Supports consistent aerobic conditioning' },
    'DIS':       { goalMode: 'maintain', reason: 'Keeps energy steady for cognitive performance' },
}
