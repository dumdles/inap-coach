'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useTheme } from '@/app/context/theme-context'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

// ── Types ─────────────────────────────────────────────────
type GoalKey = 'bulk' | 'cut' | 'maintain' | 'ippt'
type TabId = 'profile' | 'physical' | 'goal' | 'wing' | 'notifs' | 'privacy' | 'appear'

interface FormState {
    full_name: string
    username: string
    rank: string
    wing: string
    height_cm: string
    weight_kg: string
    date_of_birth: string
    gender: string
    activity_level: string
    goal_mode: GoalKey
    platoon: string
    section: string
    theme: 'light' | 'dark' | 'auto'
    units_weight: 'kg' | 'lb'
    units_height: 'cm' | 'in'
    notifs: Record<string, boolean>
    privacy: Record<string, boolean>
}

// ── Static data ───────────────────────────────────────────
const TABS: { id: TabId; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', desc: 'Name, rank, contact and password', icon: <UserIcon /> },
    { id: 'physical', label: 'Physical stats', desc: 'Height, weight, BMI and TDEE', icon: <ScaleIcon /> },
    { id: 'goal', label: 'Goal mode', desc: 'Set your nutritional objective and activity level', icon: <TargetIcon /> },
    { id: 'wing', label: 'Wing & cohort', desc: 'Your unit, platoon and section', icon: <FlagIcon /> },
    { id: 'notifs', label: 'Notifications', desc: 'Push and email reminders', icon: <BellIcon /> },
    { id: 'privacy', label: 'Privacy & data', desc: 'Leaderboard visibility and data export', icon: <ShieldIcon /> },
    { id: 'appear', label: 'Appearance', desc: 'Theme, units and language', icon: <SunIcon /> },
]

const RANKS = ['OCT', 'ME4T', '2LT', 'LTA', 'CPT', 'MAJ', 'LTC', 'SLTC', 'COL']
const WINGS = ['Alpha', 'Charlie', 'Delta', 'Echo', 'Sierra', 'Tango', 'MIDS', 'Air', 'DIS']

const ACTIVITY_LEVELS = [
    { value: 'sedentary', label: 'Sedentary', description: 'Desk-bound most of the day, little to no exercise' },
    { value: 'light', label: 'Light', description: 'Light exercise or sport 1–3 days a week' },
    { value: 'moderate', label: 'Moderate', description: 'Moderate exercise or sport 3–5 days a week' },
    { value: 'active', label: 'Active', description: 'Hard exercise or sport 6–7 days a week' },
    { value: 'very_active', label: 'Very Active', description: 'Hard daily training plus a physical job or twice-a-day sessions' },
]

const GOALS: { key: GoalKey; label: string; color: string; bg: string; desc: string; target: string; macro: string }[] = [
    { key: 'bulk', label: 'Bulk', color: '#0052CC', bg: '#DEEBFF', desc: 'Build muscle mass', target: '3,040 kcal', macro: '168g · 280g · 80g' },
    { key: 'cut', label: 'Cut', color: '#DE350B', bg: '#FFEBE6', desc: 'Lose body fat', target: '2,300 kcal', macro: '180g · 180g · 65g' },
    { key: 'maintain', label: 'Maintain', color: '#00875A', bg: '#E3FCEF', desc: 'Hold composition', target: '2,680 kcal', macro: '155g · 230g · 72g' },
    { key: 'ippt', label: 'IPPT', color: '#FF991F', bg: '#FFFAE6', desc: 'Peak for your test', target: '2,800 kcal', macro: '175g · 260g · 75g' },
]

const NOTIFS = [
    { id: 'meal_reminders', label: 'Meal log reminders', desc: "Nudges if you haven't logged by 1100 / 1500 / 1900", defaultOn: true, channels: ['push'] },
    { id: 'macro_alerts', label: 'Macro target alerts', desc: "Heads-up when you're falling behind on protein", defaultOn: true, channels: ['push'] },
    { id: 'weekly_summary', label: 'Weekly performance recap', desc: 'Sundays 1800 — your week vs your wing', defaultOn: true, channels: ['email', 'push'] },
    { id: 'ippt_reminders', label: 'IPPT prep reminders', desc: 'Nutritional cues 7 / 3 / 1 days out', defaultOn: true, channels: ['push'] },
    { id: 'leaderboard', label: 'Leaderboard movement', desc: 'When you move up or down 3+ ranks', defaultOn: false, channels: ['push'] },
    { id: 'tips', label: 'Daily nutrition tips', desc: 'One short tip every morning at 0700', defaultOn: false, channels: ['push'] },
]

const PRIVACY = [
    { id: 'leaderboard_visible', label: 'Show me on the wing leaderboard', desc: 'Other cadets in your wing can see your rank and weekly score.', defaultOn: true },
    { id: 'profile_searchable', label: 'Discoverable by name', desc: 'Cadets can find you when searching by name across cohorts.', defaultOn: true },
    { id: 'share_macros', label: 'Share macro stats with instructors', desc: 'Wing instructors can review your daily intake history.', defaultOn: true },
    { id: 'analytics', label: 'Anonymous product analytics', desc: 'Helps us improve INAP Coach. Never tied to your name.', defaultOn: true },
]

// ── Derived stats ─────────────────────────────────────────
function calcDerived(height: string, weight: string, dob: string, gender: string) {
    const h = parseFloat(height) || 0
    const w = parseFloat(weight) || 0
    const birthYear = dob ? new Date(dob).getFullYear() : 0
    const age = birthYear ? new Date().getFullYear() - birthYear : 22
    const isFemale = gender?.toLowerCase() === 'female'
    const bmi = h ? w / Math.pow(h / 100, 2) : 0
    const bmr = isFemale
        ? Math.round(10 * w + 6.25 * h - 5 * age - 161)
        : Math.round(10 * w + 6.25 * h - 5 * age + 5)
    const tdee = Math.round(bmr * 1.55)
    const bmiClass = bmi < 18.5 ? 'Under' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Over' : 'High'
    return { bmi: bmi.toFixed(1), bmr, tdee, bmiClass }
}

// ── Icon components ───────────────────────────────────────
function UserIcon() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg> }
function ScaleIcon() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14l-1 13H6L5 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg> }
function TargetIcon() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg> }
function FlagIcon() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></svg> }
function BellIcon() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" /><path d="M10 21a2 2 0 0 0 4 0" /></svg> }
function ShieldIcon() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg> }
function SunIcon() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg> }
function ChevronLeft() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg> }
function ChevronRight() { return <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg> }
function CheckIcon() { return <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg> }
function KeyIcon() { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></svg> }
function DownloadIcon() { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> }
function TrashIcon() { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg> }
function LogoutIcon() { return <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg> }

// ── Field wrapper ─────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-[#344563] dark:text-slate-300">{label}</span>
                {hint && <span className="text-[11px] text-[#A5ADBA] dark:text-slate-500">{hint}</span>}
            </div>
            {children}
        </div>
    )
}

// ── Text input ────────────────────────────────────────────
function TInput({ value, onChange, type = 'text', suffix, placeholder, disabled }: {
    value: string; onChange?: (v: string) => void; type?: string; suffix?: string; placeholder?: string; disabled?: boolean
}) {
    return (
        <div className="relative">
            <input
                type={type} value={value} onChange={e => onChange?.(e.target.value)}
                placeholder={placeholder} disabled={disabled}
                className={cn(
                    'w-full h-10 rounded-lg border border-[#C1C7D0] dark:border-slate-600 bg-white dark:bg-slate-800 text-[14px] text-[#172B4D] dark:text-slate-100 outline-none transition-all duration-150',
                    'focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10 dark:focus:border-blue-500 dark:focus:ring-blue-500/10',
                    suffix ? 'pl-3 pr-10' : 'px-3',
                    disabled && 'opacity-50 cursor-not-allowed bg-[#F5F7FA] dark:bg-slate-700'
                )}
            />
            {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#A5ADBA] dark:text-slate-500 pointer-events-none">{suffix}</span>}
        </div>
    )
}

// ── Select input (shadcn) ─────────────────────────────────
function TSelect({ value, onChange, options }: {
    value: string
    onChange: (v: string) => void
    options: string[] | { value: string; label: string }[]
}) {
    const normalised = options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full h-10 rounded-lg border border-[#C1C7D0] dark:border-slate-600 bg-white dark:bg-slate-800 text-[14px] text-[#172B4D] dark:text-slate-100 px-3 focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {normalised.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

// ── Toggle ────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button" onClick={() => onChange(!value)}
            className="relative w-9 h-[22px] rounded-full border-none cursor-pointer transition-colors duration-150 flex-shrink-0"
            style={{ background: value ? '#0052CC' : '#C1C7D0' }}
        >
            <span
                className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all duration-150"
                style={{ left: value ? 16 : 2 }}
            />
        </button>
    )
}

// ── Segmented control ─────────────────────────────────────
function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
        <div className="inline-flex p-[3px] bg-[#F5F7FA] dark:bg-slate-700 rounded-lg">
            {options.map(o => (
                <button
                    key={o.value} type="button" onClick={() => onChange(o.value)}
                    className={cn(
                        'px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 border-none cursor-pointer',
                        value === o.value
                            ? 'bg-white dark:bg-slate-600 text-[#172B4D] dark:text-slate-100 shadow-sm font-semibold'
                            : 'bg-transparent text-[#6B778C] dark:text-slate-400'
                    )}
                >{o.label}</button>
            ))}
        </div>
    )
}

// ── Section card ──────────────────────────────────────────
function SCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('bg-white dark:bg-slate-800 border border-[#DFE1E6] dark:border-slate-700 rounded-xl p-6', className)}>
            {children}
        </div>
    )
}

// ── Main settings page ────────────────────────────────────
export default function SettingsPage() {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const { setTheme } = useTheme()
    const [active, setActive] = useState<TabId>('profile')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<string | null>(null)

    const defaultForm: FormState = {
        full_name: '', username: '', rank: '', wing: '',
        height_cm: '', weight_kg: '', date_of_birth: '', gender: '',
        activity_level: 'moderate', goal_mode: 'bulk',
        platoon: '', section: '',
        theme: 'light', units_weight: 'kg', units_height: 'cm',
        notifs: Object.fromEntries(NOTIFS.map(n => [n.id, n.defaultOn])),
        privacy: Object.fromEntries(PRIVACY.map(p => [p.id, p.defaultOn])),
    }

    const [form, setForm] = useState<FormState>(defaultForm)
    const [orig, setOrig] = useState<FormState>(defaultForm)
    const dirty = JSON.stringify(form) !== JSON.stringify(orig)

    const set = useCallback((k: keyof FormState, v: unknown) => setForm(f => ({ ...f, [k]: v })), [])

    // Fetch profile
    useEffect(() => {
        if (!user) return
        supabase.from('users').select('*').eq('id', user.id).single()
            .then(({ data }) => {
                if (!data) return
                const defaultNotifs = Object.fromEntries(NOTIFS.map(n => [n.id, n.defaultOn]))
                const defaultPrivacy = Object.fromEntries(PRIVACY.map(p => [p.id, p.defaultOn]))
                const loaded: FormState = {
                    full_name: data.full_name ?? '',
                    username: data.username ?? '',
                    rank: data.rank ?? '',
                    wing: data.wing ?? '',
                    height_cm: data.height_cm?.toString() ?? '',
                    weight_kg: data.weight_kg?.toString() ?? '',
                    date_of_birth: data.date_of_birth ?? '',
                    gender: data.gender ?? '',
                    activity_level: data.activity_level ?? 'moderate',
                    goal_mode: (data.goal_mode as GoalKey) ?? 'bulk',
                    platoon: data.platoon ?? '',
                    section: data.section ?? '',
                    theme: (data.theme as FormState['theme']) ?? 'light',
                    units_weight: (data.units_weight as FormState['units_weight']) ?? 'kg',
                    units_height: (data.units_height as FormState['units_height']) ?? 'cm',
                    notifs: { ...defaultNotifs, ...(data.notif_prefs ?? {}) },
                    privacy: { ...defaultPrivacy, ...(data.privacy_prefs ?? {}) },
                }
                setForm(loaded)
                setOrig(loaded)
                setTheme(loaded.theme)
            })
            .then(() => setLoading(false))
    }, [user])

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 2600)
    }

    const save = async () => {
        if (!user) return
        setSaving(true)
        const { error } = await supabase.from('users').update({
            full_name: form.full_name,
            username: form.username,
            rank: form.rank,
            wing: form.wing,
            height_cm: parseFloat(form.height_cm) || null,
            weight_kg: parseFloat(form.weight_kg) || null,
            date_of_birth: form.date_of_birth || null,
            gender: form.gender,
            activity_level: form.activity_level,
            goal_mode: form.goal_mode,
            platoon: form.platoon,
            section: form.section,
            theme: form.theme,
            units_weight: form.units_weight,
            units_height: form.units_height,
            notif_prefs: form.notifs,
            privacy_prefs: form.privacy,
        }).eq('id', user.id)
        setSaving(false)
        if (error) { showToast('Error saving — try again'); return }
        setOrig(form)
        showToast('Settings saved')
    }

    const discard = () => setForm(orig)

    const handleSignOut = async () => { await signOut(); router.replace('/login') }

    const goal = GOALS.find(g => g.key === form.goal_mode) ?? GOALS[0]
    const derived = calcDerived(form.height_cm, form.weight_kg, form.date_of_birth, form.gender)
    const initials = form.full_name?.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U'

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-slate-900">
                <div className="w-8 h-8 rounded-full border-2 border-[#0052CC] border-t-transparent animate-spin" />
            </div>
        )
    }

    // ── Sidebar ───────────────────────────────────────────
    const sidebar = (
        <aside className="w-[264px] flex-shrink-0 h-full flex flex-col bg-[#091E42] dark:bg-slate-900 overflow-y-auto">
            {/* Logo + back */}
            <div className="flex items-center gap-2.5 px-5 py-5">
                <button onClick={() => router.back()} className="text-white/50 hover:text-white mr-1 transition-colors" aria-label="Back">
                    <ChevronLeft />
                </button>
                <div className="w-7 h-7 rounded-[7px] bg-[#0052CC] flex items-center justify-center font-display text-[13px] font-extrabold text-white flex-shrink-0">I</div>
                <div>
                    <div className="font-display text-[15px] font-extrabold tracking-tight text-white">INAP<span className="text-[#2684FF]">·</span>Coach</div>
                    <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-white/40 mt-0.5">Settings</div>
                </div>
            </div>

            {/* Cadet badge */}
            <div className="mx-3.5 mb-3.5 p-3 bg-white/[0.04] border border-white/[0.08] rounded-[10px] flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#2684FF]/20 text-[#79B8FF] flex items-center justify-center font-display text-[13px] font-bold flex-shrink-0">{initials}</div>
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-white truncate">{[form.rank, form.full_name].filter(Boolean).join(' ')}</div>
                    <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-white/50">{form.wing} Wing</div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2.5 flex flex-col gap-0.5">
                {TABS.map(tab => {
                    const isActive = tab.id === active
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActive(tab.id)}
                            className={cn(
                                'relative flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-[9px] text-[13px] transition-all duration-150 border-none cursor-pointer overflow-hidden',
                                isActive ? 'bg-[#2684FF]/16 text-[#79B8FF] font-semibold' : 'bg-transparent text-white/65 font-medium hover:bg-white/[0.05]'
                            )}
                        >
                            {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-sm" style={{ background: goal.color }} />}
                            <span className="flex-shrink-0">{tab.icon}</span>
                            <span className="flex-1">{tab.label}</span>
                            {isActive && <ChevronRight />}
                        </button>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="px-3.5 py-3 border-t border-white/[0.08]">
                <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[12px] text-white/50 hover:text-white/75 bg-transparent border-none cursor-pointer rounded-lg transition-colors">
                    <LogoutIcon /> Sign out
                </button>
            </div>
        </aside>
    )

    const tabMeta = TABS.find(t => t.id === active)!

    // ── Section header ────────────────────────────────────
    const header = (
        <div className="mb-7">
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#A5ADBA] dark:text-slate-500 mb-2">
                Settings · <span className="text-[#0052CC] dark:text-blue-400">{tabMeta.label}</span>
            </div>
            <div className="font-display text-[32px] font-bold tracking-tight text-[#091E42] dark:text-slate-100 leading-none">{tabMeta.label}</div>
            <div className="text-[14px] text-[#6B778C] dark:text-slate-400 mt-2 max-w-xl">{tabMeta.desc}.</div>
        </div>
    )

    // ── Section bodies ────────────────────────────────────
    const ProfileSection = (
        <div className="flex flex-col gap-4">
            <SCard>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#DEEBFF] dark:bg-blue-900/40 text-[#003A8C] dark:text-blue-300 flex items-center justify-center font-display text-[22px] font-bold">{initials}</div>
                    <div className="flex-1">
                        <div className="text-[15px] font-bold text-[#091E42] dark:text-slate-100">{[form.rank, form.full_name].filter(Boolean).join(' ')}</div>
                        <div className="text-[12px] text-[#6B778C] dark:text-slate-400 mt-0.5">{form.wing} Wing</div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                    <Field label="Full name"><TInput value={form.full_name} onChange={v => set('full_name', v)} /></Field>
                    <Field label="Username"><TInput value={form.username} onChange={v => set('username', v)} /></Field>
                    <Field label="Rank"><TSelect value={form.rank} onChange={v => set('rank', v)} options={RANKS} /></Field>
                    <Field label="Email"><TInput value={user?.email ?? ''} disabled /></Field>
                </div>
            </SCard>
            <SCard>
                <div className="font-display text-[15px] font-bold text-[#091E42] dark:text-slate-100 mb-1">Password & security</div>
                <div className="text-[12px] text-[#6B778C] dark:text-slate-400 mb-4">Keep your account secure with a strong password.</div>
                <div className="flex gap-2.5">
                    <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-700 border border-[#DFE1E6] dark:border-slate-600 rounded-lg text-[13px] font-medium text-[#172B4D] dark:text-slate-200 cursor-pointer hover:border-[#A5ADBA] dark:hover:border-slate-500 transition-colors">
                        <KeyIcon /> Change password
                    </button>
                </div>
            </SCard>
        </div>
    )

    const PhysicalSection = (
        <div className="flex flex-col gap-4">
            <SCard>
                <div className="">
                    <Field label="Gender"><TSelect value={form.gender} onChange={v => set('gender', v)} options={['Male', 'Female']} /></Field>
                </div>
            </SCard>
            <SCard>
                <div className="grid grid-cols-3 gap-3.5 mb-5">
                    <Field label="Height" hint="(cm)"><TInput type="number" value={form.height_cm} onChange={v => set('height_cm', v)} suffix="cm" /></Field>
                    <Field label="Weight" hint="(kg)"><TInput type="number" value={form.weight_kg} onChange={v => set('weight_kg', v)} suffix="kg" /></Field>
                    <Field label="Date of Birth"><TInput type="date" value={form.date_of_birth} onChange={v => set('date_of_birth', v)} /></Field>
                </div>
                {/* Derived stat strip */}
                <div className="grid grid-cols-3 bg-[#F5F7FA] dark:bg-slate-700/50 border border-[#EBECF0] dark:border-slate-700 rounded-[10px] overflow-hidden">
                    {[
                        { l: 'BMI', v: derived.bmi, s: derived.bmiClass },
                        { l: 'BMR', v: derived.bmr, s: 'kcal at rest' },
                        { l: 'TDEE', v: derived.tdee, s: 'kcal w/ training' },
                    ].map((r, i) => (
                        <div key={r.l} className={cn('p-3.5', i < 2 && 'border-r border-[#EBECF0] dark:border-slate-700')}>
                            <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#A5ADBA] dark:text-slate-500">{r.l}</div>
                            <div className="font-display text-[22px] font-bold text-[#091E42] dark:text-slate-100 tracking-tight mt-0.5">{r.v}</div>
                            <div className="text-[11px] text-[#6B778C] dark:text-slate-400 mt-0.5">{r.s}</div>
                        </div>
                    ))}
                </div>
            </SCard>
            <div className="rounded-xl p-5 text-white flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #091E42 0%, #003A8C 100%)' }}>
                <div className="w-11 h-11 rounded-[10px] bg-white/10 flex items-center justify-center flex-shrink-0">
                    <TargetIcon />
                </div>
                <div className="flex-1">
                    <div className="text-[12px] font-semibold tracking-[0.1em] uppercase text-white/60 mb-1">Auto-recalculated</div>
                    <div className="text-[14px]">
                        New {goal.label.toLowerCase()} target:{' '}
                        <span className="font-display font-bold text-[17px] text-white">{goal.target}/day</span>
                        {' '}· {goal.macro} (P · C · F)
                    </div>
                </div>
            </div>
        </div>
    )

    const GoalSection = (
        <div className="flex flex-col gap-4">
            <SCard>
                <div className="font-display text-[15px] font-bold text-[#091E42] dark:text-slate-100 mb-1">Activity level</div>
                <div className="text-[13px] text-[#6B778C] dark:text-slate-400 mb-4">How active are you outside of NS? This affects your daily calorie targets.</div>
                <div className="flex flex-col gap-2">
                    {ACTIVITY_LEVELS.map(a => {
                        const isActive = a.value === form.activity_level
                        return (
                            <button
                                key={a.value} type="button" onClick={() => set('activity_level', a.value)}
                                className={cn(
                                    'text-left px-4 py-3 rounded-[10px] border-[1.5px] cursor-pointer transition-all duration-150 flex items-center justify-between gap-3',
                                    'hover:scale-[1.005] active:scale-[0.99]',
                                    isActive
                                        ? 'border-[#0052CC] bg-[#DEEBFF] dark:bg-blue-900/30 dark:border-blue-500'
                                        : 'border-[#DFE1E6] dark:border-slate-600 bg-white dark:bg-slate-700/60 hover:border-slate-400 dark:hover:border-slate-500'
                                )}
                            >
                                <span className={cn('font-semibold text-[14px]', isActive ? 'text-[#0052CC] dark:text-blue-400' : 'text-[#091E42] dark:text-slate-100')}>{a.label}</span>
                                <span className="text-[12px] text-[#6B778C] dark:text-slate-400 text-right max-w-[60%]">{a.description}</span>
                            </button>
                        )
                    })}
                </div>
            </SCard>
            <SCard>
                <div className="font-display text-[15px] font-bold text-[#091E42] dark:text-slate-100 mb-1">Goal mode</div>
                <div className="text-[13px] text-[#6B778C] dark:text-slate-400 mb-4">Your current nutritional objective. Targets are recalculated when you change this.</div>
                <div className="grid grid-cols-2 gap-2.5">
                    {GOALS.map(g => {
                        const isActive = g.key === form.goal_mode
                        return (
                            <button
                                key={g.key} type="button" onClick={() => set('goal_mode', g.key)}
                                className={cn(
                                    'text-left p-4 rounded-[10px] border-[1.5px] cursor-pointer transition-all duration-200 ease-out flex items-center justify-between gap-3',
                                    'hover:scale-[1.02] active:scale-[0.98]',
                                    isActive ? 'shadow-lg' : 'bg-white dark:bg-slate-700/60 border-[#DFE1E6] dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                                )}
                                style={isActive ? {
                                    borderColor: g.color,
                                    background: g.color,
                                    boxShadow: `0 4px 16px ${g.color}40`,
                                } : undefined}
                            >
                                <div>
                                    <div className={cn('font-display text-[16px] font-bold tracking-tight mb-0.5', isActive ? 'text-white' : 'text-[#091E42] dark:text-slate-100')}>{g.label}</div>
                                    <div className={cn('text-[11px]', isActive ? 'text-white/78' : 'text-[#6B778C] dark:text-slate-400')}>{g.desc} · {g.target}</div>
                                </div>
                                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200', isActive ? 'bg-white/20 text-white opacity-100' : 'opacity-0 scale-75')}>
                                    <CheckIcon />
                                </div>
                            </button>
                        )
                    })}
                </div>
            </SCard>
        </div>
    )

    const WingSection = (
        <div className="flex flex-col gap-4">
            <SCard>
                <div className="flex items-center justify-between mb-1">
                    <div className="font-display text-[15px] font-bold text-[#091E42] dark:text-slate-100">Wing</div>
                </div>
                <div className="text-[13px] text-[#6B778C] dark:text-slate-400 mb-3">Wing assignment is set at sign-up and can only be changed by an instructor.</div>
                <div className="h-10 flex items-center px-3 rounded-lg bg-[#F5F7FA] dark:bg-slate-700/50 border border-[#EBECF0] dark:border-slate-700 text-[14px] font-medium text-[#172B4D] dark:text-slate-200">
                    {form.wing || '—'}
                </div>
                <div className="grid grid-cols-2 gap-3.5 mt-4">
                    <Field label="Platoon"><TInput value={form.platoon} onChange={v => set('platoon', v)} placeholder="e.g. 1" /></Field>
                    <Field label="Section"><TInput value={form.section} onChange={v => set('section', v)} placeholder="e.g. A" /></Field>
                </div>
            </SCard>
        </div>
    )

    const NotifsSection = (
        <SCard>
            <div className="flex flex-col">
                {NOTIFS.map((n, i) => (
                    <div key={n.id} className={cn('flex items-center gap-4 py-3.5', i < NOTIFS.length - 1 && 'border-b border-[#F5F7FA] dark:border-slate-700')}>
                        <div className="flex-1">
                            <div className="text-[14px] font-semibold text-[#172B4D] dark:text-slate-200">{n.label}</div>
                            <div className="text-[12px] text-[#6B778C] dark:text-slate-400 mt-0.5">{n.desc}</div>
                        </div>
                        <div className="flex gap-1.5">
                            {n.channels.map(c => (
                                <span key={c} className="px-2 py-0.5 bg-[#F5F7FA] dark:bg-slate-700 border border-[#EBECF0] dark:border-slate-600 rounded-full text-[10px] font-semibold tracking-wide uppercase text-[#6B778C] dark:text-slate-400">{c}</span>
                            ))}
                        </div>
                        <Toggle value={form.notifs[n.id]} onChange={v => setForm(f => ({ ...f, notifs: { ...f.notifs, [n.id]: v } }))} />
                    </div>
                ))}
            </div>
        </SCard>
    )

    const PrivacySection = (
        <div className="flex flex-col gap-4">
            <SCard>
                <div className="flex flex-col">
                    {PRIVACY.map((p, i) => (
                        <div key={p.id} className={cn('flex items-center gap-4 py-3.5', i < PRIVACY.length - 1 && 'border-b border-[#F5F7FA] dark:border-slate-700')}>
                            <div className="flex-1">
                                <div className="text-[14px] font-semibold text-[#172B4D] dark:text-slate-200">{p.label}</div>
                                <div className="text-[12px] text-[#6B778C] dark:text-slate-400 mt-0.5">{p.desc}</div>
                            </div>
                            <Toggle value={form.privacy[p.id]} onChange={v => setForm(f => ({ ...f, privacy: { ...f.privacy, [p.id]: v } }))} />
                        </div>
                    ))}
                </div>
            </SCard>
            <SCard>
                <div className="font-display text-[15px] font-bold text-[#091E42] dark:text-slate-100 mb-3.5">Your data</div>
                <div className="flex gap-2.5">
                    <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-700 border border-[#DFE1E6] dark:border-slate-600 rounded-lg text-[13px] font-medium text-[#172B4D] dark:text-slate-200 cursor-pointer hover:border-[#A5ADBA] dark:hover:border-slate-500 transition-colors">
                        <DownloadIcon /> Export my data
                    </button>
                    <button className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FFEBE6] dark:bg-red-900/20 border border-[#FFBDAD] dark:border-red-800/40 rounded-lg text-[13px] font-medium text-[#BF2600] dark:text-red-400 cursor-pointer">
                        <TrashIcon /> Delete account
                    </button>
                </div>
            </SCard>
        </div>
    )

    const AppearSection = (
        <SCard>
            <div className="flex flex-col gap-5">
                {[
                    { label: 'Theme', desc: 'Match the app to your environment.', control: <Segmented value={form.theme} onChange={v => { set('theme', v); setTheme(v as 'light' | 'dark' | 'auto') }} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'auto', label: 'Auto' }]} /> },
                    { label: 'Weight units', desc: 'Used across logs and stat displays.', control: <Segmented value={form.units_weight} onChange={v => set('units_weight', v)} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} /> },
                    { label: 'Height units', desc: 'cm or feet/inches.', control: <Segmented value={form.units_height} onChange={v => set('units_height', v)} options={[{ value: 'cm', label: 'cm' }, { value: 'in', label: 'ft / in' }]} /> },
                ].map(row => (
                    <div key={row.label} className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-[14px] font-semibold text-[#172B4D] dark:text-slate-200">{row.label}</div>
                            <div className="text-[12px] text-[#6B778C] dark:text-slate-400">{row.desc}</div>
                        </div>
                        {row.control}
                    </div>
                ))}
            </div>
        </SCard>
    )

    const sections: Record<TabId, React.ReactNode> = {
        profile: ProfileSection,
        physical: PhysicalSection,
        goal: GoalSection,
        wing: WingSection,
        notifs: NotifsSection,
        privacy: PrivacySection,
        appear: AppearSection,
    }

    return (
        <div className="flex h-screen bg-[#F5F7FA] dark:bg-slate-900 overflow-hidden relative">
            {sidebar}
            <main className="flex-1 overflow-y-auto px-12 py-10 pb-24">
                <div className="max-w-[720px] mx-auto">
                    {header}
                    <div key={active} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {sections[active]}
                    </div>
                </div>
            </main>

            {/* Floating save pill */}
            {dirty && (
                <div className="absolute left-1/2 bottom-6 -translate-x-1/2 flex items-center gap-2 bg-[#091E42] text-white rounded-full px-4 py-1.5 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-3 duration-200" style={{ paddingLeft: 18 }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF991F] flex-shrink-0" />
                    <span className="text-[12px] font-medium mr-1.5">Unsaved changes</span>
                    <button onClick={discard} className="px-3 py-1.5 bg-white/[0.08] text-white/75 border-none rounded-full text-[12px] font-medium cursor-pointer hover:bg-white/[0.14] transition-colors">
                        Discard
                    </button>
                    <button onClick={save} disabled={saving} className="px-3.5 py-1.5 bg-[#0052CC] text-white border-none rounded-full text-[12px] font-semibold cursor-pointer hover:bg-[#003A8C] transition-colors disabled:opacity-60">
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-[#091E42] text-white px-4 py-2.5 rounded-[10px] text-[13px] font-medium shadow-xl z-[200] animate-in fade-in slide-in-from-top-2 duration-200">
                    <span className="w-[18px] h-[18px] rounded-full bg-[#00875A] flex items-center justify-center flex-shrink-0 text-white">
                        <CheckIcon />
                    </span>
                    {toast}
                </div>
            )}
        </div>
    )
}
