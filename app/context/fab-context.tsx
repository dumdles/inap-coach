'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

// ── Floating action button (FAB) context ───────────────────
// The mobile FAB lives in the dashboard layout, but its action is contextual:
// each page registers what it should do (log a meal, log sleep, log a workout…)
// via useFab(). Pages keep ownership of their own dialogs — the FAB just triggers
// the action the current page registered. Routes that register nothing hide the FAB.

export type FabAction = {
    /** Accessible label, e.g. "Log a meal". */
    label: string
    /** Main glyph shown in the FAB (the layout adds the small "+" badge). */
    icon: React.ReactNode
    /** Fired when the FAB is tapped — typically opens the page's log dialog. */
    onClick: () => void
}

type FabEntry = { label: string; icon: React.ReactNode; trigger: () => void }

const FabContext = createContext<{
    entry: FabEntry | null
    setEntry: React.Dispatch<React.SetStateAction<FabEntry | null>>
}>({ entry: null, setEntry: () => {} })

export function FabProvider({ children }: { children: React.ReactNode }) {
    const [entry, setEntry] = useState<FabEntry | null>(null)
    return <FabContext.Provider value={{ entry, setEntry }}>{children}</FabContext.Provider>
}

/** Read the FAB action registered by the current page (used by the layout). */
export function useFabEntry() {
    return useContext(FabContext).entry
}

/**
 * Register the FAB action for the current page. Call once per page.
 * The action is cleared automatically on unmount (route change).
 */
export function useFab(action: FabAction) {
    const { setEntry } = useContext(FabContext)
    // Keep the latest action in a ref so the trigger/icon stay fresh without
    // re-registering on every render (onClick/icon are new objects each render).
    const ref = useRef(action)
    ref.current = action

    // Re-register only when the page action (keyed by label) changes — depending
    // on the icon/onClick identities would re-run every render and loop setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        setEntry({ label: action.label, icon: action.icon, trigger: () => ref.current.onClick() })
        return () => setEntry(null)
    }, [action.label, setEntry])
}
