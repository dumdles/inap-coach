'use client'

import { useEffect, useRef, useState } from 'react'

// ── Styles ─────────────────────────────────────────────────────────────────────
// Auto-injected once. The wrapper drives all motion; the path draw
// animates the stroke from invisible (dashoffset == dasharray) to visible.
// Path M5 12l5 5L20 7 has total length ≈ 21, so dasharray matches.
const STYLES = `
.t-success-check {
  display: inline-block;
  transform-origin: center;
  opacity: 0;
  will-change: transform, opacity, filter;
}
.t-success-check svg { display: block; overflow: visible; }
.t-success-check svg path {
  stroke-dasharray: 21;
  stroke-dashoffset: 21;
}
.t-success-check[data-state="in"] {
  animation:
    t-check-fade   550ms cubic-bezier(0.22,1,0.36,1) forwards,
    t-check-rotate 550ms cubic-bezier(0.22,1,0.36,1) forwards,
    t-check-blur   500ms cubic-bezier(0.22,1,0.36,1) forwards,
    t-check-bob    450ms cubic-bezier(0.34,1.35,0.64,1) forwards;
}
.t-success-check[data-state="in"] svg path {
  animation: t-check-draw 550ms cubic-bezier(0.22,1,0.36,1) 80ms forwards;
}
@keyframes t-check-fade   { from { opacity: 0; }             to { opacity: 1; } }
@keyframes t-check-rotate { from { transform: rotate(80deg);} to { transform: rotate(0deg); } }
@keyframes t-check-blur   { from { filter: blur(10px); }     to { filter: blur(0); } }
@keyframes t-check-bob    { from { translate: 0 40px; }      to { translate: 0 0; } }
@keyframes t-check-draw   { to   { stroke-dashoffset: 0; } }
/* Overlay fade-in — used by the logged success overlay in log-meal-dialog */
@keyframes t-overlay-in { from { opacity: 0; } to { opacity: 1; } }
.t-overlay-in { animation: t-overlay-in 280ms cubic-bezier(0.22,1,0.36,1) forwards; }
@media (prefers-reduced-motion: reduce) {
  .t-success-check { animation: none !important; opacity: 1; }
  .t-success-check svg path { animation: none !important; stroke-dashoffset: 0 !important; }
  .t-overlay-in { animation: none !important; }
}
`

function injectStyles() {
    if (typeof document === 'undefined') return
    if (document.getElementById('fitrep-success-check')) return
    const el = document.createElement('style')
    el.id = 'fitrep-success-check'
    el.textContent = STYLES
    document.head.appendChild(el)
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
    /** Flip to true to fire the entrance animation. Toggle back to false to reset. */
    playing: boolean
    size?: number
}

export function SuccessCheck({ playing, size = 32 }: Props) {
    const ref = useRef<HTMLSpanElement>(null)
    const [state, setState] = useState<'out' | 'in'>('out')

    useEffect(() => { injectStyles() }, [])

    useEffect(() => {
        if (!playing) { setState('out'); return }
        // Reset first so rapid re-triggers replay cleanly from offset 0
        setState('out')
        requestAnimationFrame(() => {
            if (ref.current) void ref.current.offsetWidth // force layout so keyframes restart
            setState('in')
        })
    }, [playing])

    return (
        <span ref={ref} className="t-success-check" data-state={state} aria-hidden="true">
            <svg
                viewBox="0 0 24 24"
                width={size}
                height={size}
                fill="none"
                stroke="var(--success)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M5 12l5 5L20 7" />
            </svg>
        </span>
    )
}
