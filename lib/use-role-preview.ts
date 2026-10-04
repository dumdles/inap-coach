'use client'

import { useSyncExternalStore } from 'react'
import { parsePreview, type RolePreview } from '@/lib/role-preview'

// Browser-side store for the superadmin "View as" preview (see lib/role-preview.ts).
// Kept per tab in sessionStorage: it survives reloads and navigation, but a new
// tab (or signing out — auth-context clears it) always starts as yourself.
// A tiny module-level store rather than React context, because authFetch (a plain
// function, not a component) also needs to read it.

const KEY = 'fitrep:role-preview'
const listeners = new Set<() => void>()
let loaded = false
let current: RolePreview | null = null

function load() {
    if (loaded || typeof window === 'undefined') return
    loaded = true
    try {
        const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
        current = raw ? parsePreview(raw.role, raw.wing) : null
    } catch { current = null }
}

/** The active preview, or null when viewing as yourself. */
export function getRolePreview(): RolePreview | null {
    load()
    return current
}

/** Start (or switch) a preview; pass null to go back to your own view. */
export function setRolePreview(next: RolePreview | null) {
    loaded = true
    current = next
    try {
        if (next) sessionStorage.setItem(KEY, JSON.stringify(next))
        else sessionStorage.removeItem(KEY)
    } catch { /* storage blocked — the preview still works for this page load */ }
    listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

/** Re-renders when the preview changes. */
export function useRolePreview(): RolePreview | null {
    return useSyncExternalStore(subscribe, getRolePreview, () => null)
}

/** Short tag for cache keys, so each view keeps its own cached API responses. */
export function previewTag(p: RolePreview | null): string {
    return p ? `${p.role}:${p.wing ?? ''}` : ''
}
