'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// ── BottomSheet ────────────────────────────────────────────
// A mobile-only sheet that slides up from the bottom of the screen.
//
// Why this exists: the previous inline "More" sheet only animated on close.
// It mounted already in the open position, so there was no closed frame for the
// browser to transition *from* on open. The fix here is the two-frame dance in
// the effect below: we mount in the closed position, let the browser paint it,
// then flip `visible` on the next animation frame so the slide-up actually runs.
//
// Used by the mobile nav "More" sheet and the notifications sheet. Dialogs use
// the responsive Radix Dialog instead (see components/ui/dialog.tsx).
export function BottomSheet({
    open,
    onClose,
    children,
    className,
    contentClassName,
}: {
    open: boolean
    onClose: () => void
    children: React.ReactNode
    /** Extra classes for the sheet panel (e.g. max-height). */
    className?: string
    /** Extra classes for the inner padded content wrapper. */
    contentClassName?: string
}) {
    // `rendered` keeps the sheet mounted through the close animation.
    const [rendered, setRendered] = useState(false)
    // `visible` drives the translate/opacity — toggled a frame after mount.
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (open) {
            setRendered(true)
            // Wait two frames: the first paints the closed state, the second
            // flips to open so the CSS transition has a starting point to animate from.
            let raf2 = 0
            const raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setVisible(true))
            })
            return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
        }
        // Closing — animate out; unmount happens in onTransitionEnd once hidden.
        setVisible(false)
    }, [open])

    if (!rendered || typeof document === 'undefined') return null

    return createPortal(
        <div
            className="fixed inset-0 z-[60] md:hidden"
            onTransitionEnd={() => { if (!visible) setRendered(false) }}
        >
            {/* Backdrop */}
            <div
                className={cn(
                    'absolute inset-0 bg-black/50 transition-opacity duration-300',
                    visible ? 'opacity-100' : 'opacity-0'
                )}
                onClick={onClose}
            />

            {/* Sheet panel */}
            <div
                className={cn(
                    'absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out',
                    visible ? 'translate-y-0' : 'translate-y-full',
                    className
                )}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                </div>

                <div className={contentClassName}>
                    {children}
                </div>

                {/* Safe-area spacer for the home indicator */}
                <div style={{ height: 'env(safe-area-inset-bottom)' }} />
            </div>
        </div>,
        document.body
    )
}
