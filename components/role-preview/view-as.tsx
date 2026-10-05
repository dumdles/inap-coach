'use client'

// ── "View as" (superadmin role preview) — UI ─────────────────────────────────
// A superadmin picks Cadet or Instructor (+ a wing) and the whole app switches
// to that experience: nav, pages and API answers. The mechanics live in
// lib/role-preview.ts (rules) and lib/use-role-preview.ts (the per-tab store).
//
//   <ViewAsProvider enabled={isSuperadmin(realRole)} ownWing=…>  ← dashboard layout
//   useViewAs()?.open()          ← "View as…" menu items / Admin console button
//   <ViewAsSidebarCard/>         ← desktop indicator while previewing
//   <ViewAsMobilePill/>          ← phone indicator while previewing

import React, { createContext, useContext, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Eye, GraduationCap, LayoutGrid, ShieldCheck, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useData } from '@/lib/use-data'
import { setRolePreview, useRolePreview } from '@/lib/use-role-preview'
import { PREVIEW_ROLE_LABEL, type PreviewRole, type RolePreview } from '@/lib/role-preview'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Choice = PreviewRole | 'self'

const CHOICES: { value: Choice; label: string; Icon: typeof Eye; blurb: string }[] = [
    { value: 'cadet', label: 'Cadet', Icon: GraduationCap, blurb: 'Logging, leaderboard and the challenges their wing is in. No My Wing or Admin.' },
    { value: 'instructor', label: 'Instructor', Icon: LayoutGrid, blurb: 'Adds My Wing (roster, cadet profiles) and creating challenges — for the chosen wing only.' },
    { value: 'self', label: 'Superadmin (you)', Icon: ShieldCheck, blurb: 'Every wing and the Admin console. Ends the preview.' },
]

type Ctx = { open: () => void }
const ViewAsContext = createContext<Ctx | null>(null)

/** `open()` for the "View as" dialog, or null when the user isn't a superadmin. */
export function useViewAs() {
    return useContext(ViewAsContext)
}

/** Holds the dialog. `enabled` must come from the user's REAL role (superadmin). */
export function ViewAsProvider({ enabled, ownWing, children }: { enabled: boolean; ownWing: string | null; children: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    if (!enabled) return <>{children}</>
    return (
        <ViewAsContext.Provider value={{ open: () => setOpen(true) }}>
            {children}
            {open && <ViewAsDialog ownWing={ownWing} onClose={() => setOpen(false)} />}
        </ViewAsContext.Provider>
    )
}

function ViewAsDialog({ ownWing, onClose }: { ownWing: string | null; onClose: () => void }) {
    const router = useRouter()
    const pathname = usePathname()
    const current = useRolePreview()
    const [choice, setChoice] = useState<Choice>(current?.role ?? 'cadet')
    const [wing, setWing] = useState<string>(current?.wing ?? ownWing ?? '')

    // Same cached wing list as the My Wing page.
    const { data: wings = [] } = useData<string[]>('wings:list', async () => {
        const { data, error } = await supabase.from('ocs_wings').select('name').order('name')
        if (error) throw error
        return (data ?? []).map(w => w.name)
    })
    const pickedWing = wing || wings[0] || ''
    const needsWing = choice !== 'self'

    function apply() {
        const next: RolePreview | null = choice === 'self' ? null : { role: choice, wing: pickedWing || null }
        setRolePreview(next)
        onClose()
        // Pages the new role can't open (Admin, My Wing) send it home themselves;
        // starting a preview from the Admin console goes straight to the home screen.
        if (next && pathname.startsWith('/dashboard/admin')) router.push('/dashboard')
    }

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose() }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-[17px]">View FitRep as…</DialogTitle>
                    <DialogDescription>
                        See exactly what each role sees. Your own logs stay on screen — only the role and wing change, and nothing can be created or approved while previewing.
                    </DialogDescription>
                </DialogHeader>

                <div role="radiogroup" aria-label="Role" className="flex flex-col gap-2">
                    {CHOICES.map(({ value, label, Icon, blurb }) => {
                        const selected = choice === value
                        return (
                            <button key={value} type="button" role="radio" aria-checked={selected}
                                onClick={() => setChoice(value)}
                                className={cn(
                                    'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                                    selected ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-border hover:bg-muted dark:hover:bg-background',
                                )}>
                                <span className={cn('w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0',
                                    selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground dark:bg-background')}>
                                    <Icon size={16} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[14px] font-semibold text-foreground">{label}</span>
                                    <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{blurb}</span>
                                </span>
                            </button>
                        )
                    })}
                </div>

                {needsWing && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-medium text-foreground" htmlFor="view-as-wing">Wing</label>
                        <Select value={pickedWing} onValueChange={setWing} disabled={!wings.length}>
                            <SelectTrigger id="view-as-wing" className="w-full"><SelectValue placeholder="Loading wings…" /></SelectTrigger>
                            <SelectContent>
                                {wings.map(w => <SelectItem key={w} value={w}>{w}{w === ownWing ? ' (yours)' : ''}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <p className="text-[12px] text-muted-foreground">
                            {choice === 'instructor' ? 'My Wing and challenge scope use this wing.' : 'The wing leaderboard and challenges use this wing.'}
                        </p>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={apply} disabled={needsWing && !pickedWing}>
                        {choice === 'self' ? (current ? 'Back to my view' : 'Stay as myself') : current ? 'Switch view' : 'Start preview'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function previewLabel(p: RolePreview) {
    return `${PREVIEW_ROLE_LABEL[p.role]}${p.wing ? ` · ${p.wing}` : ''}`
}

/**
 * Desktop sidebar slot just above the profile tag (superadmins only):
 * a one-click "View as…" button, or — while previewing — what you're viewing
 * as with Switch / Exit.
 */
export function ViewAsSidebarCard({ expanded }: { expanded: boolean }) {
    const preview = useRolePreview()
    const viewAs = useViewAs()
    if (!viewAs) return null

    if (!preview) return (
        <button onClick={viewAs.open} title={!expanded ? 'View as…' : undefined}
            className={cn(
                'mb-2 h-9 rounded-xl inline-flex items-center gap-2.5 text-[13px] font-medium transition-colors',
                'text-sidebar-foreground/60 hover:text-sidebar-foreground ring-1 ring-sidebar-border hover:bg-sidebar-accent/60',
                expanded ? 'mx-2.5 px-3' : 'mx-2 justify-center',
            )}>
            <Eye size={16} className="shrink-0" />
            {expanded && <span className="whitespace-nowrap">View as…</span>}
        </button>
    )

    if (!expanded) return (
        <button onClick={viewAs.open} title={`Viewing as ${previewLabel(preview)} — click to switch or exit`}
            className="mx-2 mb-2 h-9 rounded-xl inline-flex items-center justify-center bg-warning-light text-warning-dark ring-1 ring-warning/50">
            <Eye size={16} />
        </button>
    )

    return (
        <div className="mx-2.5 mb-2 rounded-xl bg-warning-light ring-1 ring-warning/50 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warning-dark">
                <Eye size={12} /> Viewing as
            </div>
            <div className="mt-0.5 text-[13px] font-semibold text-sidebar-foreground truncate">{previewLabel(preview)}</div>
            <div className="mt-2 flex gap-1.5">
                <button onClick={viewAs.open} className="flex-1 h-7 rounded-lg text-[12px] font-medium bg-card text-foreground ring-1 ring-border hover:bg-muted transition-colors">Switch</button>
                <button onClick={() => setRolePreview(null)} className="flex-1 h-7 rounded-lg text-[12px] font-medium bg-card text-foreground ring-1 ring-border hover:bg-muted transition-colors">Exit</button>
            </div>
        </div>
    )
}

/** Phone indicator while previewing — a pill pinned top-left (the bell sits top-right). */
export function ViewAsMobilePill() {
    const preview = useRolePreview()
    const viewAs = useViewAs()
    if (!preview || !viewAs) return null
    return (
        <div className="fixed top-4 left-4 right-[68px] z-50 md:hidden flex items-center h-10 rounded-full bg-card ring-1 ring-warning shadow-md pl-1 pr-1">
            <button onClick={viewAs.open} className="flex-1 min-w-0 flex items-center gap-2 h-8 pl-1 pr-2 rounded-full text-left">
                <span className="w-7 h-7 rounded-full bg-warning-light text-warning-dark inline-flex items-center justify-center shrink-0"><Eye size={14} /></span>
                <span className="min-w-0 text-[12px] leading-tight">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-warning-dark">Viewing as</span>
                    <span className="block font-semibold text-foreground truncate">{previewLabel(preview)}</span>
                </span>
            </button>
            <button onClick={() => setRolePreview(null)} aria-label="Exit preview"
                className="w-8 h-8 rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0">
                <X size={16} />
            </button>
        </div>
    )
}
