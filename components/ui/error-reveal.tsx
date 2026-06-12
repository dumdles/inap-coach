'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Stagger animation styles ──────────────────────────────────────────────────
// Injected once into <head> on first render. Idempotent and SSR-safe.
const STYLES = `
.t-stagger-line {
  display: block;
  opacity: 0;
  transform: translateY(10px);
  filter: blur(3px);
  transition:
    opacity   500ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 500ms cubic-bezier(0.22, 1, 0.36, 1),
    filter    500ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, opacity, filter;
}
.t-stagger-line--2 { transition-delay: 40ms; }
.t-stagger.is-shown .t-stagger-line {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}
.t-stagger.is-hiding .t-stagger-line {
  opacity: 0;
  transform: translateY(0);
  filter: blur(0);
  transition: opacity 180ms ease !important;
  transition-delay: 0s !important;
}
@media (prefers-reduced-motion: reduce) {
  .t-stagger-line { transition: none !important; }
}
`

function injectStyles() {
    if (typeof document === 'undefined') return
    if (document.getElementById('fitrep-stagger-styles')) return
    const el = document.createElement('style')
    el.id = 'fitrep-stagger-styles'
    el.textContent = STYLES
    document.head.appendChild(el)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
    /** Primary message. Pass null/undefined to animate out. */
    message: string | null | undefined
    /** Optional secondary line — shown below the message with a slight stagger delay. */
    hint?: string
    /** 'error' = destructive red, 'warning' = amber */
    variant?: 'error' | 'warning'
    className?: string
}

/**
 * Drop-in replacement for a bare <p className="text-destructive">.
 * Animates in on mount / message change and fades out when message is cleared.
 */
export function ErrorReveal({ message, hint, variant = 'error', className }: Props) {
    const [shown, setShown] = useState(false)
    const [hiding, setHiding] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => { injectStyles() }, [])

    useEffect(() => {
        if (message) {
            // New or changed message — replay the staggered entrance
            if (timerRef.current) clearTimeout(timerRef.current)
            setHiding(false)
            setShown(false)
            // Let the DOM settle before flipping to shown so the entrance transition plays
            requestAnimationFrame(() => setShown(true))
        } else {
            // Message cleared — quiet fade-out, then stop rendering
            setShown(false)
            setHiding(true)
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => setHiding(false), 200)
        }
    }, [message])

    if (!message && !hiding) return null

    const primaryClass = variant === 'warning' ? 'text-warning' : 'text-destructive'
    const cls = cn('t-stagger', shown && 'is-shown', hiding && 'is-hiding', className)

    return (
        <div className={cls}>
            <strong className={cn('t-stagger-line t-stagger-line--1 text-sm font-medium not-italic', primaryClass)}>
                {message}
            </strong>
            {hint && (
                <span className="t-stagger-line t-stagger-line--2 text-xs text-muted-foreground">
                    {hint}
                </span>
            )}
        </div>
    )
}
