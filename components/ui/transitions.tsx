'use client'

/**
 * transitions.tsx — Animation primitives adapted from Transitions.dev
 * Used by the nutrition calculator and anywhere else numbers/tabs/loading text need motion.
 *
 * All CSS is injected once into <head> at module load time (idempotent, SSR-safe).
 */

import { useEffect, useRef } from 'react'

// ── Injected stylesheet ────────────────────────────────────────────────────────
// Single injection keyed by 'transitions-inap'. Contains all three animations.
const TRANSITION_CSS = `
/* ─── Number pop-in ─────────────────────────────────────────────────────────── */
:root {
  --digit-dur: 480ms;
  --digit-distance: 10px;
  --digit-stagger: 55ms;
  --digit-blur: 3px;
  --digit-ease: cubic-bezier(0.34, 1.45, 0.64, 1);
}
@keyframes t-digit-pop-in {
  0%   { transform: translateY(var(--digit-distance)); opacity: 0; filter: blur(var(--digit-blur)); }
  100% { transform: translateY(0);                    opacity: 1; filter: blur(0); }
}
.t-digit-group { display: inline-flex; align-items: baseline; }
.t-digit       { display: inline-block; will-change: transform, opacity, filter; }
.t-digit-group.is-animating .t-digit {
  animation: t-digit-pop-in var(--digit-dur) var(--digit-ease) both;
}
@media (prefers-reduced-motion: reduce) {
  .t-digit-group .t-digit { animation: none !important; }
}

/* ─── Shimmer text ──────────────────────────────────────────────────────────── */
:root {
  --shimmer-dur:  1800ms;
  --shimmer-band: 400%;
  --shimmer-base: #6B778C;
  --shimmer-highlight: #091E42;
}
.dark {
  --shimmer-base: #8892A4;
  --shimmer-highlight: #e8edf5;
}
.t-shimmer {
  position: relative;
  display: inline-block;
  color: var(--shimmer-base);
}
.t-shimmer::before {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(
    90deg,
    transparent 0%, transparent 35%,
    var(--shimmer-highlight) 50%,
    transparent 65%, transparent 100%
  );
  background-size: var(--shimmer-band) 100%;
  background-repeat: no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: t-shimmer var(--shimmer-dur) linear infinite;
}
@keyframes t-shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: 0%   0; }
}
@media (prefers-reduced-motion: reduce) {
  .t-shimmer::before { animation: none !important; }
}

/* ─── Sliding tabs ──────────────────────────────────────────────────────────── */
:root {
  --tabs-dur:  200ms;
  --tabs-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --tabs-bar-bg:    #EBECF0;
  --tabs-pill-bg:   #FFFFFF;
  --tabs-text-muted:  rgba(107,119,140,0.9);
  --tabs-text-active: #091E42;
}
.dark {
  --tabs-bar-bg:    #172B4D;
  --tabs-pill-bg:   #1F3460;
  --tabs-text-muted:  rgba(165,175,190,0.7);
  --tabs-text-active: #FFFFFF;
}
.t-tabs {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 48px;
  background: var(--tabs-bar-bg);
}
.t-tab {
  position: relative;
  appearance: none;
  border: 0;
  background: transparent;
  height: 28px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--tabs-text-muted);
  cursor: pointer;
  border-radius: 48px;
  z-index: 1;
  transition: color var(--tabs-dur) var(--tabs-ease);
  white-space: nowrap;
}
.t-tab:not([aria-selected="true"]):hover,
.t-tab[aria-selected="true"] { color: var(--tabs-text-active); }
.t-tabs-pill {
  position: absolute;
  top: 3px; left: 0;
  height: 28px; width: 0;
  background: var(--tabs-pill-bg);
  border-radius: 48px;
  box-shadow: 0 1px 3px rgba(9,30,66,0.14), 0 0 1px rgba(9,30,66,0.08);
  transform: translateX(0);
  transition:
    transform var(--tabs-dur) var(--tabs-ease),
    width     var(--tabs-dur) var(--tabs-ease);
  will-change: transform, width;
  z-index: 0;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .t-tabs-pill, .t-tab { transition: none !important; }
}
`

function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('transitions-inap')) return
    const el = document.createElement('style')
    el.id = 'transitions-inap'
    el.textContent = TRANSITION_CSS
    document.head.appendChild(el)
}

// ── NumberPopIn ────────────────────────────────────────────────────────────────
// Plays pop-in on mount. Change `key` on the caller to re-trigger on value change.
export function NumberPopIn({ value, className }: { value: string; className?: string }) {
    injectStyles()
    return (
        <span className={['t-digit-group is-animating', className].filter(Boolean).join(' ')}>
            {value.split('').map((ch, i) => (
                <span
                    key={i}
                    className="t-digit"
                    style={i > 0 ? { animationDelay: `calc(var(--digit-stagger) * ${i})` } : undefined}
                >
                    {ch}
                </span>
            ))}
        </span>
    )
}

// ── Shimmer ────────────────────────────────────────────────────────────────────
// Keep `children` and `data-text` in sync — both must carry the same string.
export function Shimmer({ children, className }: { children: string; className?: string }) {
    injectStyles()
    return (
        <span
            className={['t-shimmer', className].filter(Boolean).join(' ')}
            data-text={children}
        >
            {children}
        </span>
    )
}

// ── SlidingTabs ────────────────────────────────────────────────────────────────
// Controlled: pass `active` index + `onChange` from parent. Pill animates on click;
// snaps (no animation) on mount and resize so layout shifts don't desync it.
export function SlidingTabs({
    tabs,
    active,
    onChange,
    className,
}: {
    tabs: string[]
    active: number
    onChange: (i: number) => void
    className?: string
}) {
    injectStyles()
    const pillRef = useRef<HTMLSpanElement>(null)
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

    const movePill = (idx: number, animate: boolean) => {
        const tab  = tabRefs.current[idx]
        const pill = pillRef.current
        if (!tab || !pill) return
        if (!animate) {
            const prev = pill.style.transition
            pill.style.transition = 'none'
            pill.style.transform  = `translateX(${tab.offsetLeft}px)`
            pill.style.width      = `${tab.offsetWidth}px`
            void pill.offsetWidth        // force reflow so transition is disabled for this frame
            pill.style.transition = prev
        } else {
            pill.style.transform = `translateX(${tab.offsetLeft}px)`
            pill.style.width     = `${tab.offsetWidth}px`
        }
    }

    // Snap on mount and whenever active changes externally; re-snap on resize
    useEffect(() => {
        const id = requestAnimationFrame(() => movePill(active, false))
        const onResize = () => movePill(active, false)
        window.addEventListener('resize', onResize)
        return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize) }
    }, [active, tabs.length])

    return (
        <div className={['t-tabs', className].filter(Boolean).join(' ')} role="tablist">
            <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
            {tabs.map((label, i) => (
                <button
                    key={label}
                    ref={el => { tabRefs.current[i] = el }}
                    type="button"
                    className="t-tab"
                    role="tab"
                    aria-selected={i === active}
                    onClick={() => { onChange(i); movePill(i, true) }}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}
