'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useTheme } from '@/app/context/theme-context'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input-field'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'

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
    ippt_date: string
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

const ACTIVITY_LEVELS = [
    { value: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
    { value: 'light', label: 'Light', description: 'Light exercise 1–3 days a week' },
    { value: 'moderate', label: 'Moderate', description: 'Moderate exercise 3–5 days a week' },
    { value: 'active', label: 'Active', description: 'Hard exercise 6–7 days a week' },
    { value: 'very_active', label: 'Very Active', description: 'Hard daily training plus a physical job or twice-a-day sessions' },
]

const GOALS: { key: GoalKey; label: string; color: string; desc: string; target: string; macro: string }[] = [
    { key: 'bulk', label: 'Bulk', color: '#0052CC', desc: 'Build muscle mass', target: '3,040 kcal', macro: '168g · 280g · 80g' },
    { key: 'cut', label: 'Cut', color: '#DE350B', desc: 'Lose body fat', target: '2,300 kcal', macro: '180g · 180g · 65g' },
    { key: 'maintain', label: 'Maintain', color: '#00875A', desc: 'Hold composition', target: '2,680 kcal', macro: '155g · 230g · 72g' },
    { key: 'ippt', label: 'IPPT', color: '#FF991F', desc: 'Peak for your test', target: '2,800 kcal', macro: '175g · 260g · 75g' },
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
]

const DATA = [
    { id: 'export', label: 'Export my data', desc: 'Download all your personal and performance data in a machine-readable format', action: 'export' },
    { id: 'delete', label: 'Delete my account', desc: 'Permanently delete your account and all associated data. This action cannot be undone!', action: 'delete' },
]

// ── Derived stats ─────────────────────────────────────────
function calcDerived(height: string, weight: string, dob: string, gender: string) {
    const h = parseFloat(height) || 0
    const w = parseFloat(weight) || 0
    const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 22
    const isFemale = gender?.toLowerCase() === 'female'
    const bmi = h ? w / Math.pow(h / 100, 2) : 0
    const bmr = isFemale
        ? Math.round(10 * w + 6.25 * h - 5 * age - 161)
        : Math.round(10 * w + 6.25 * h - 5 * age + 5)
    const tdee = Math.round(bmr * 1.55)
    const bmiClass = bmi < 18.5 ? 'Under' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Over' : 'High'
    return { bmi: bmi.toFixed(1), bmr, tdee, bmiClass }
}

// ── Icons ─────────────────────────────────────────────────
function UserIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg> }
function ScaleIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14l-1 13H6L5 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg> }
function TargetIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg> }
function FlagIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></svg> }
function BellIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" /><path d="M10 21a2 2 0 0 0 4 0" /></svg> }
function ShieldIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg> }
function SunIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg> }
function CheckIcon() { return <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg> }
function KeyIcon() { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></svg> }
function DownloadIcon() { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> }
function TrashIcon() { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg> }


// ── Goal mode icons ───────────────────────────────────────
function GoalBulkIcon() {
    return (
        <svg viewBox="0 0 18 18" width={16} height={16} fill="currentColor">
            <rect x="1" y="6" width="2.5" height="6" rx="1" />
            <rect x="14.5" y="6" width="2.5" height="6" rx="1" />
            <rect x="3" y="5" width="2" height="8" rx="0.75" />
            <rect x="13" y="5" width="2" height="8" rx="0.75" />
            <rect x="5" y="7.5" width="8" height="3" rx="0.75" />
        </svg>
    )
}
function GoalCutIcon() {
    return (
        <svg viewBox="0 0 18 18" width={16} height={16} fill="currentColor">
            <path d="M9 1.5C8 4 6 5.5 6.5 8.5C5 7.5 5 5 5 5C3.5 7 4 10 4 10C4 13.5 6.2 16.5 9 16.5C11.8 16.5 14 13.5 14 10C14 7.5 12.5 6 12.5 6C12.5 8 11.5 8.5 11.5 8.5C12 6 9 1.5 9 1.5Z" />
        </svg>
    )
}
function GoalMaintainIcon() {
    return (
        <svg viewBox="0 0 18 18" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9Q5.5 5 9 9Q12.5 13 16 9" />
        </svg>
    )
}
function GoalIpptIcon() {
    return (
        <svg viewBox="0 0 18 18" width={16} height={16} fill="currentColor">
            <path d="M9 1.5L10.9 6.4L16.5 6.4L12.2 9.5L13.9 14.5L9 11.4L4.1 14.5L5.8 9.5L1.5 6.4L7.1 6.4Z" />
        </svg>
    )
}

const GOAL_ICONS: Record<string, React.ReactNode> = {
    bulk: <GoalBulkIcon />,
    cut: <GoalCutIcon />,
    maintain: <GoalMaintainIcon />,
    ippt: <GoalIpptIcon />,
}

// ── Secondary nav groups ──────────────────────────────────
const NAV_GROUPS: { label: string; ids: TabId[] }[] = [
    { label: 'Account', ids: ['profile', 'physical', 'wing'] },
    { label: 'Training', ids: ['goal'] },
    { label: 'Preferences', ids: ['notifs', 'privacy', 'appear'] },
]

// ── Section card ──────────────────────────────────────────
// Uses design-system tokens so it inherits light/dark automatically
function SCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('bg-card border border-border rounded-xl p-6 text-card-foreground', className)}>
            {children}
        </div>
    )
}

// ── Toggle (no shadcn Switch available) ──────────────────
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

// ── Segmented control (no shadcn equivalent) ──────────────
function Segmented({ value, onChange, options }: {
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string }[]
}) {
    return (
        <div className="inline-flex p-[3px] bg-muted dark:bg-[#091E42] rounded-lg">
            {options.map(o => (
                <button
                    key={o.value} type="button" onClick={() => onChange(o.value)}
                    className={cn(
                        'px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 border-none cursor-pointer',
                        value === o.value
                            ? 'bg-card dark:bg-[#1F3460] text-foreground shadow-sm font-semibold'
                            : 'bg-transparent text-muted-foreground'
                    )}
                >{o.label}</button>
            ))}
        </div>
    )
}

// ── Field label wrapper ───────────────────────────────────
function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
                <Label>{label}</Label>
                {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
            </div>
            {children}
        </div>
    )
}

// ── Main settings page ────────────────────────────────────
export default function SettingsPage() {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const { setTheme, setGoalMode } = useTheme()
    const [active, setActive] = useState<TabId>('profile')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<string | null>(null)
    const [pwDialog, setPwDialog] = useState(false)
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
    const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string; general?: string }>({})
    const [pwSaving, setPwSaving] = useState(false)
    const [deleteDialog, setDeleteDialog] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState('')
    const [deleteError, setDeleteError] = useState('')
    const [deleting, setDeleting] = useState(false)

    const defaultForm: FormState = {
        full_name: '', username: '', rank: '', wing: '',
        height_cm: '', weight_kg: '', date_of_birth: '', gender: '',
        activity_level: 'moderate', goal_mode: 'bulk', ippt_date: '',
        platoon: '', section: '',
        theme: 'light', units_weight: 'kg', units_height: 'cm',
        notifs: Object.fromEntries(NOTIFS.map(n => [n.id, n.defaultOn])),
        privacy: Object.fromEntries(PRIVACY.map(p => [p.id, p.defaultOn])),
    }

    const [form, setForm] = useState<FormState>(defaultForm)
    const [orig, setOrig] = useState<FormState>(defaultForm)
    const dirty = JSON.stringify(form) !== JSON.stringify(orig)

    const set = useCallback((k: keyof FormState, v: unknown) => setForm(f => ({ ...f, [k]: v })), [])

    useEffect(() => {
        if (!user) return
        supabase.from('users').select('*').eq('id', user.id).single()
            .then(({ data }) => {
                if (!data) return
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
                    ippt_date: data.ippt_date ?? '',
                    platoon: data.platoon ?? '',
                    section: data.section ?? '',
                    theme: (data.theme as FormState['theme']) ?? 'light',
                    units_weight: (data.units_weight as FormState['units_weight']) ?? 'kg',
                    units_height: (data.units_height as FormState['units_height']) ?? 'cm',
                    notifs: { ...Object.fromEntries(NOTIFS.map(n => [n.id, n.defaultOn])), ...(data.notif_prefs ?? {}) },
                    privacy: { ...Object.fromEntries(PRIVACY.map(p => [p.id, p.defaultOn])), ...(data.privacy_prefs ?? {}) },
                }
                setForm(loaded)
                setOrig(loaded)
                setTheme(loaded.theme)
                setGoalMode(loaded.goal_mode)
            })
            .then(() => setLoading(false))
    }, [user])

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    const save = async () => {
        if (!user) return
        setSaving(true)
        const { error } = await supabase.from('users').update({
            full_name: form.full_name,
            username: form.username,
            rank: form.rank,
            height_cm: parseFloat(form.height_cm) || null,
            weight_kg: parseFloat(form.weight_kg) || null,
            date_of_birth: form.date_of_birth || null,
            gender: form.gender,
            activity_level: form.activity_level,
            goal_mode: form.goal_mode,
            ippt_date: form.ippt_date || null,
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
        setGoalMode(form.goal_mode)
        showToast('Settings saved')
    }

    const changePassword = async () => {
        const errs: typeof pwErrors = {}
        if (!pwForm.current) errs.current = 'Current password is required'
        if (!pwForm.next) errs.next = 'New password is required'
        else if (pwForm.next.length < 8) errs.next = 'Must be at least 8 characters'
        if (!pwForm.confirm) errs.confirm = 'Please confirm your new password'
        else if (pwForm.next !== pwForm.confirm) errs.confirm = 'Passwords do not match'
        if (Object.keys(errs).length) { setPwErrors(errs); return }

        setPwSaving(true)
        setPwErrors({})

        // Re-authenticate with current password first
        const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: user?.email ?? '',
            password: pwForm.current,
        })
        if (signInErr) {
            setPwErrors({ current: 'Current password is incorrect' })
            setPwSaving(false)
            return
        }

        const { error } = await supabase.auth.updateUser({ password: pwForm.next })
        setPwSaving(false)
        if (error) { setPwErrors({ general: error.message }); return }
        setPwDialog(false)
        setPwForm({ current: '', next: '', confirm: '' })
        showToast('Password changed')
    }

    const deleteAccount = async () => {
        if (deleteConfirm !== 'DELETE') { setDeleteError('Type DELETE to confirm'); return }
        setDeleting(true)
        setDeleteError('')
        // Re-authenticate then delete via Supabase admin RPC or auth delete
        const { error } = await supabase.rpc('delete_user')
        if (error) {
            setDeleteError('Could not delete account — please contact support.')
            setDeleting(false)
            return
        }
        await signOut()
        router.replace('/login')
    }

    const goal = GOALS.find(g => g.key === form.goal_mode) ?? GOALS[0]
    const derived = calcDerived(form.height_cm, form.weight_kg, form.date_of_birth, form.gender)
    const initials = form.full_name?.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U'

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
        )
    }

    // ── Secondary nav sidebar ─────────────────────────────
    const secondarySidebar = (
        <aside className="w-[196px] flex-shrink-0 h-full flex flex-col  border-r border-sidebar-border overflow-y-auto py-3">
            {NAV_GROUPS.map(({ label, ids }, gi) => (
                <div key={label} className={cn('flex flex-col', gi > 0 && 'mt-4')}>
                    <div className="px-4 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase text-sidebar-foreground/40 select-none">
                        {label}
                    </div>
                    <div className="px-2 flex flex-col gap-0.5">
                        {ids.map(id => {
                            const tab = TABS.find(t => t.id === id)!
                            const isActive = tab.id === active
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActive(tab.id)}
                                    className={cn(
                                        'relative flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 border-none cursor-pointer',
                                        isActive
                                            ? 'bg-sidebar-accent text-sidebar-foreground font-semibold'
                                            : 'text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground font-medium'
                                    )}
                                >
                                    {isActive && (
                                        <span className="absolute left-0 inset-y-1.5 w-[3px] bg-primary rounded-r-full" />
                                    )}
                                    <span className="flex-shrink-0">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            ))}
        </aside>
    )

    const tabMeta = TABS.find(t => t.id === active)!

    const header = (
        <div className="mb-7">
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-2">
                Settings · <span className="text-primary">{tabMeta.label}</span>
            </div>
            <div className="font-display text-[32px] font-bold tracking-tight text-foreground leading-none">{tabMeta.label}</div>
            <div className="text-[14px] text-muted-foreground mt-2 max-w-xl">{tabMeta.desc}.</div>
        </div>
    )

    // ── Sections ──────────────────────────────────────────
    const ProfileSection = (
        <div className="flex flex-col gap-4">
            <SCard>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary-light text-primary-dark flex items-center justify-center font-display text-[22px] font-bold">{initials}</div>
                    <div className="flex-1">
                        <div className="text-[15px] font-bold text-foreground">{[form.rank, form.full_name].filter(Boolean).join(' ')}</div>
                        <div className="text-[12px] text-muted-foreground mt-0.5">{form.wing} Wing</div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                    <InputField label="Full name" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                    <InputField label="Username" value={form.username} onChange={e => set('username', e.target.value)} />
                    <FieldLabel label="Rank">
                        <Select value={form.rank} onValueChange={v => set('rank', v)}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>{RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                    </FieldLabel>
                    <InputField label="Email" value={user?.email ?? ''} disabled />
                </div>
            </SCard>
            <SCard>
                <div className="flex flex-row w-full justify-between items-center">
                    <div className="flex flex-col gap-1">
                        <div className="font-display text-[15px] font-bold text-foreground">Password & security</div>
                        <div className="text-[12px] text-muted-foreground">Keep your account secure with a strong password.</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setPwForm({ current: '', next: '', confirm: '' }); setPwErrors({}); setPwDialog(true) }}>
                        <KeyIcon /> Change password
                    </Button>
                </div>
            </SCard>
        </div>
    )

    const PhysicalSection = (
        <div className="flex flex-col gap-4">
            <SCard>
                <FieldLabel label="Gender">
                    <Select value={form.gender} onValueChange={v => set('gender', v)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                    </Select>
                </FieldLabel>
            </SCard>
            <SCard>
                <div className="grid grid-cols-3 gap-3.5 mb-5">
                    <InputField label="Height" hint="cm" type="number" value={form.height_cm} onChange={e => set('height_cm', e.target.value)} suffix="cm" />
                    <InputField label="Weight" hint="kg" type="number" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} suffix="kg" />
                    <FieldLabel label="Date of Birth">
                        <DatePicker value={form.date_of_birth} onChange={v => set('date_of_birth', v)} className='mt-2' />
                    </FieldLabel>
                </div>
                <div className="grid grid-cols-3 bg-muted border border-border rounded-[10px] overflow-hidden">
                    {[
                        { l: 'BMI', v: derived.bmi, s: derived.bmiClass },
                        { l: 'BMR', v: derived.bmr, s: 'kcal at rest' },
                        { l: 'TDEE', v: derived.tdee, s: 'kcal w/ training' },
                    ].map((r, i) => (
                        <div key={r.l} className={cn('p-3.5', i < 2 && 'border-r border-border')}>
                            <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">{r.l}</div>
                            <div className="font-display text-[22px] font-bold text-foreground tracking-tight mt-0.5">{r.v}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{r.s}</div>
                        </div>
                    ))}
                </div>
            </SCard>
            <div className="rounded-xl p-5 text-white flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #091E42 0%, #003A8C 100%)' }}>
                <div className="w-11 h-11 rounded-[10px] bg-white/10 flex items-center justify-center flex-shrink-0"><TargetIcon /></div>
                <div className="flex-1">
                    <div className="text-[12px] font-semibold tracking-[0.1em] uppercase text-white/60 mb-1">Auto-recalculated</div>
                    <div className="text-[14px]">
                        New {goal.label.toLowerCase()} target:{' '}
                        <span className="font-display font-bold text-[17px]">{goal.target}/day</span>
                        {' '}· {goal.macro} (P · C · F)
                    </div>
                </div>
            </div>
        </div>
    )

    const GoalSection = (
        <div className="flex flex-col gap-4">
            <SCard>
                <div className="font-display text-[15px] font-bold text-foreground mb-1">Activity level</div>
                <div className="text-[13px] text-muted-foreground mb-4">How active are you outside of NS? This affects your daily calorie targets.</div>
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
                                        ? 'border-primary bg-primary-light dark:bg-primary/20 dark:border-primary'
                                        : 'border-border bg-card hover:border-muted-foreground/40'
                                )}
                            >
                                <span className={cn('font-semibold text-[14px]', isActive ? 'text-primary' : 'text-foreground')}>{a.label}</span>
                                <span className="text-[12px] text-muted-foreground text-right max-w-[60%]">{a.description}</span>
                            </button>
                        )
                    })}
                </div>
            </SCard>
            <SCard>
                <div className="font-display text-[15px] font-bold text-foreground mb-1">Goal mode</div>
                <div className="text-[13px] text-muted-foreground mb-4">Your current nutritional objective. Targets are recalculated when you change this.</div>
                <div className="grid grid-cols-2 gap-2.5">
                    {GOALS.map(g => {
                        const isActive = g.key === form.goal_mode
                        return (
                            <button
                                key={g.key} type="button" onClick={() => set('goal_mode', g.key)}
                                className={cn(
                                    'group text-left p-4 rounded-[10px] border-[1.5px] cursor-pointer transition-all duration-200 ease-out flex items-center justify-between gap-3',
                                    'hover:scale-[1.02] active:scale-[0.98]',
                                    isActive ? 'shadow-lg' : 'bg-card border-border hover:border-muted-foreground/40'
                                )}
                                style={isActive ? { borderColor: g.color, background: g.color, boxShadow: `0 4px 16px ${g.color}40` } : undefined}
                            >
                                <div>
                                    <div className={cn('font-display text-[16px] font-bold tracking-tight mb-0.5', isActive ? 'text-white' : 'text-foreground')}>{g.label}</div>
                                    <div className={cn('text-[11px]', isActive ? 'text-white/80' : 'text-muted-foreground')}>{g.desc} · {g.target}</div>
                                </div>
                                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                    {isActive ? (
                                        <div className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center animate-in zoom-in-75 duration-150">
                                            <CheckIcon />
                                        </div>
                                    ) : (
                                        <span
                                            className="text-muted-foreground/40 transition-all duration-200 group-hover:scale-125 group-hover:text-foreground/60"
                                            style={{ display: 'flex' }}
                                        >
                                            {GOAL_ICONS[g.key]}
                                        </span>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </SCard>
            <SCard>
                <div className="font-display text-[15px] font-bold text-foreground mb-1">Next IPPT date</div>
                <div className="text-[13px] text-muted-foreground mb-4">Set your upcoming IPPT so the app can tailor your nutrition in the lead-up.</div>
                <FieldLabel label="IPPT date">
                    <DatePicker value={form.ippt_date} onChange={v => set('ippt_date', v)} className="mt-2" />
                </FieldLabel>
                {form.ippt_date && (() => {
                    const days = Math.ceil((new Date(form.ippt_date).getTime() - Date.now()) / 86_400_000)
                    if (days < 0) return (
                        <div className="mt-3 text-[12px] text-muted-foreground">IPPT date has passed — update it when your next one is scheduled.</div>
                    )
                    return (
                        <div className="mt-3 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning-light text-warning-dark text-[12px] font-semibold">
                                {days === 0 ? 'Today!' : days === 1 ? '1 day to go' : `${days} days to go`}
                            </span>
                        </div>
                    )
                })()}
            </SCard>
        </div>
    )

    const WingSection = (
        <div className="flex flex-col gap-4">
            <SCard>
                <div className="flex items-center justify-between mb-1">
                    <div className="font-display text-[15px] font-bold text-foreground">Wing</div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-muted text-muted-foreground rounded-full">Read-only</span>
                </div>
                <div className="text-[13px] text-muted-foreground mb-3">Wing assignment is set at sign-up and can only be changed by an instructor.</div>
                <div className="h-10 flex items-center px-3 rounded-lg bg-muted border border-border text-[14px] font-medium text-foreground">
                    {form.wing || '—'}
                </div>
            </SCard>
            <SCard>
                <div className="grid grid-cols-2 gap-3.5">
                    <InputField label="Platoon" value={form.platoon} onChange={e => set('platoon', e.target.value)} placeholder="e.g. 1" />
                    <InputField label="Section" value={form.section} onChange={e => set('section', e.target.value)} placeholder="e.g. A" />
                </div>
            </SCard>
        </div>
    )

    const NotifsSection = (
        <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-warning-light border border-warning/30">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-warning-dark flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span className="text-[12px] font-medium text-warning-dark">Preferences are saved but push/email delivery isn't active yet — coming soon.</span>
        </div>
        <SCard>
            <div className="flex flex-col divide-y divide-border">
                {NOTIFS.map(n => (
                    <div key={n.id} className="flex items-center gap-4 py-3.5">
                        <div className="flex-1">
                            <div className="text-[14px] font-semibold text-foreground">{n.label}</div>
                            <div className="text-[12px] text-muted-foreground mt-0.5">{n.desc}</div>
                        </div>
                        <div className="flex gap-1.5">
                            {n.channels.map(c => (
                                <span key={c} className="px-2 py-0.5 bg-muted border border-border rounded-full text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">{c}</span>
                            ))}
                        </div>
                        <Toggle value={form.notifs[n.id]} onChange={v => setForm(f => ({ ...f, notifs: { ...f.notifs, [n.id]: v } }))} />
                    </div>
                ))}
            </div>
        </SCard>
        </div>
    )

    const PrivacySection = (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-warning-light border border-warning/30">
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-warning-dark flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="text-[12px] font-medium text-warning-dark">Leaderboard visibility and instructor data sharing are saved but not yet enforced — coming soon.</span>
            </div>
            <SCard>
                 <div className="font-display text-[15px] font-bold text-foreground">Privacy</div>
                <div className="text-[13px] text-muted-foreground mb-3">Manage your account's privacy preferences.</div>
                <div className="flex flex-col divide-y divide-border">
                    {PRIVACY.map(p => (
                        <div key={p.id} className="flex items-center gap-4 py-3.5">
                            <div className="flex-1">
                                <div className="text-[14px] font-semibold text-foreground">{p.label}</div>
                                <div className="text-[12px] text-muted-foreground mt-0.5">{p.desc}</div>
                            </div>
                            <Toggle value={form.privacy[p.id]} onChange={v => setForm(f => ({ ...f, privacy: { ...f.privacy, [p.id]: v } }))} />
                        </div>
                    ))}
                </div>
            </SCard>
            <SCard>
                <div className="font-display text-[15px] font-bold text-foreground">Personal Data</div>
                <div className="text-[13px] text-muted-foreground mb-3">Manage your account's personal information and data preferences.</div>
                <div className="flex flex-col divide-y divide-border">
                    {DATA.map(p => (
                        <div key={p.id} className="flex items-center gap-4 py-3.5">
                            <div className="flex-1">
                                <div className="text-[14px] font-semibold text-foreground">{p.label}</div>
                                <div className="text-[12px] text-muted-foreground mt-0.5">{p.desc}</div>
                            </div>
                            {p.action === 'export' && (
                                <Button variant="outline" size="sm" onClick={() => showToast('coming-soon:Data export is coming soon')}>
                                    <DownloadIcon /> Export my data
                                </Button>
                            )}
                            {p.action === 'delete' && (
                                <Button variant="destructive" size="sm" onClick={() => { setDeleteConfirm(''); setDeleteError(''); setDeleteDialog(true) }}>
                                    <TrashIcon /> Delete account
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </SCard>
        </div>
    )

    const AppearSection = (
        <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-warning-light border border-warning/30">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-warning-dark flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span className="text-[12px] font-medium text-warning-dark">Theme applies immediately. Weight and height unit conversion is saved but not yet applied to displays — coming soon.</span>
        </div>
        <SCard>
            <div className="flex flex-col gap-5">
                {([
                    { label: 'Theme', desc: 'Match the app to your environment.', key: 'theme' as const, options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'auto', label: 'Auto' }] },
                    { label: 'Weight units', desc: 'Used across logs and stat displays.', key: 'units_weight' as const, options: [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }] },
                    { label: 'Height units', desc: 'cm or feet/inches.', key: 'units_height' as const, options: [{ value: 'cm', label: 'cm' }, { value: 'in', label: 'ft / in' }] },
                ]).map(row => (
                    <div key={row.label} className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-[14px] font-semibold text-foreground">{row.label}</div>
                            <div className="text-[12px] text-muted-foreground">{row.desc}</div>
                        </div>
                        <Segmented
                            value={form[row.key]}
                            onChange={v => {
                                set(row.key, v)
                                if (row.key === 'theme') setTheme(v as 'light' | 'dark' | 'auto')
                            }}
                            options={row.options}
                        />
                    </div>
                ))}
            </div>
        </SCard>
        </div>
    )

    const sections: Record<TabId, React.ReactNode> = {
        profile: ProfileSection, physical: PhysicalSection, goal: GoalSection,
        wing: WingSection, notifs: NotifsSection, privacy: PrivacySection, appear: AppearSection,
    }

    return (
        <div className="flex h-full overflow-hidden relative bg-background">
            {secondarySidebar}
            <main className="flex-1 overflow-y-auto px-10 py-9 pb-24">
                <div className="max-w-[680px]">
                    {header}
                    <div key={active} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {sections[active]}
                    </div>
                </div>
            </main>

            {dirty && (
                <div className="absolute left-1/2 bottom-6 -translate-x-1/2 flex items-center gap-2 bg-[#091E42] text-white rounded-full px-4 py-1.5 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-3 duration-200" style={{ paddingLeft: 18 }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />
                    <span className="text-[12px] font-medium mr-1.5">Unsaved changes</span>
                    <Button variant="ghost" size="sm" onClick={() => setForm(orig)} className="rounded-full text-white/75 hover:text-white hover:bg-white/[0.14] h-7 px-3">
                        Discard
                    </Button>
                    <Button size="sm" onClick={save} disabled={saving} className="rounded-full h-7 px-3.5">
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            )}

            {toast && (() => {
                const isComingSoon = toast.startsWith('coming-soon:')
                const msg = isComingSoon ? toast.slice('coming-soon:'.length) : toast
                return (
                    <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-2.5 rounded-[10px] text-[13px] font-medium shadow-xl z-[200] animate-in fade-in slide-in-from-top-2 duration-200 text-white"
                        style={{ background: isComingSoon ? '#344563' : '#091E42' }}>
                        <span className={cn('w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 text-[10px]', isComingSoon ? 'bg-warning/80' : 'bg-success')}>
                            {isComingSoon ? '✦' : <CheckIcon />}
                        </span>
                        {msg}
                    </div>
                )
            })()}

            <Dialog open={deleteDialog} onOpenChange={open => { setDeleteDialog(open); if (!open) { setDeleteConfirm(''); setDeleteError('') } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-display text-[18px] font-bold text-destructive">Delete account</DialogTitle>
                        <DialogDescription>
                            This will permanently delete your account and all associated data — nutrition logs, progress history, and settings. <strong>This cannot be undone.</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3.5 py-3 text-[13px] text-destructive font-medium">
                            You will be immediately signed out and your data will be queued for permanent deletion.
                        </div>
                        {deleteError && (
                            <div className="text-[13px] text-destructive bg-destructive/10 rounded-lg px-3 py-2">{deleteError}</div>
                        )}
                        <InputField
                            label='Type "DELETE" to confirm'
                            value={deleteConfirm}
                            onChange={e => setDeleteConfirm(e.target.value)}
                            placeholder="DELETE"
                        />
                    </div>
                    <DialogFooter showCloseButton>
                        <Button
                            variant="destructive"
                            onClick={deleteAccount}
                            disabled={deleting || deleteConfirm !== 'DELETE'}
                        >
                            {deleting ? 'Deleting…' : 'Permanently delete account'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={pwDialog} onOpenChange={open => { setPwDialog(open); if (!open) setPwErrors({}) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-display text-[18px] font-bold">Change password</DialogTitle>
                        <DialogDescription>Enter your current password, then choose a new one.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        {pwErrors.general && (
                            <div className="text-[13px] text-destructive bg-destructive/10 rounded-lg px-3 py-2">{pwErrors.general}</div>
                        )}
                        <InputField
                            label="Current password"
                            type="password"
                            autoComplete="current-password"
                            value={pwForm.current}
                            onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                            error={pwErrors.current}
                        />
                        <InputField
                            label="New password"
                            type="password"
                            autoComplete="new-password"
                            value={pwForm.next}
                            onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                            error={pwErrors.next}
                            hint="At least 8 characters"
                        />
                        <InputField
                            label="Confirm new password"
                            type="password"
                            autoComplete="new-password"
                            value={pwForm.confirm}
                            onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                            error={pwErrors.confirm}
                        />
                    </div>
                    <DialogFooter showCloseButton>
                        <Button onClick={changePassword} disabled={pwSaving}>
                            {pwSaving ? 'Saving…' : 'Change password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
