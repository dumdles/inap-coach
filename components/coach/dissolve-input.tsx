'use client'

// Input clear with dissolve (transitions.dev), adapted for the AI coach chat.
//
// Original pattern: a search input whose × button dissolves the text — the
// typed glyphs fly up and blur out, the placeholder flies back in, and a
// per-word glow streak sweeps the bottom edge.
//
// Adaptation here: the dissolve plays when the cadet SENDS a message. The
// parent stays a normal controlled component; it calls `dissolve(text)` via
// ref right before clearing its state. We only mirror the text for the
// duration of the animation (not on every keystroke like the original), which
// keeps the controlled <textarea> simple.
//
// Resting styles + tuning variables live in app/globals.css (.t-clear*).
// The per-frame tweening must be JS: the streak's rise → peak → fall envelope
// can't be expressed as a static @keyframe.

import React, { forwardRef, useImperativeHandle, useRef } from 'react'

export type DissolveInputHandle = {
    /** Plays the dissolve for the given text. Call right before clearing the value. */
    dissolve: (text: string) => void
}

type Props = {
    value: string
    onChange: (value: string) => void
    onEnter: () => void
    placeholder: string
    className?: string
}

// ── CSS variable readers — live tweaks apply on the next dissolve ──

function readNum(name: string, fallback: number): number {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
    return Number.isFinite(v) ? v : fallback
}

// Durations need unit-aware parsing: the CSS minifier rewrites `1000ms` to
// `1s`, and parseFloat('1s') would silently become 1 millisecond.
function readMs(name: string, fallback: number): number {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    const v = parseFloat(raw)
    if (!Number.isFinite(v)) return fallback
    return raw.endsWith('ms') ? v : raw.endsWith('s') ? v * 1000 : v
}

function readEase(name: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
}

/** Converts a cubic-bezier() string into a JS easing function (Newton's method). */
function makeEase(ease: string): (t: number) => number {
    const m = ease.match(/cubic-bezier\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i)
    if (!m) return t => t
    const [x1, y1, x2, y2] = [m[1], m[2], m[3], m[4]].map(parseFloat)
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const sX = (s: number) => ((ax * s + bx) * s + cx) * s
    const sY = (s: number) => ((ay * s + by) * s + cy) * s
    const dX = (s: number) => (3 * ax * s + 2 * bx) * s + cx
    return (t: number) => {
        if (t <= 0) return 0
        if (t >= 1) return 1
        let s = t
        for (let i = 0; i < 8; i++) {
            const dx = sX(s) - t
            if (Math.abs(dx) < 1e-6) break
            const d = dX(s)
            if (d === 0) break
            s -= dx / d
        }
        return sY(s)
    }
}

// Measures each word of the sent text and builds a stack of radial-gradient
// layers positioned under the word centres — the glow streak. Light mode
// paints black (multiply blend), dark mode white (screen blend) — the blend
// modes are set in globals.css.
const measureCtx: { current: CanvasRenderingContext2D | null } = { current: null }

function buildGlowLayers(wrapWidth: number, text: string): string {
    const padLeft = 16 // matches the textarea's px-4
    const spread = readNum('--glow-spread', 1.5)
    if (!measureCtx.current) {
        measureCtx.current = document.createElement('canvas').getContext('2d')
    }
    const ctx = measureCtx.current
    if (!ctx) return ''
    ctx.font = '400 14px "DM Sans", sans-serif' // matches the textarea font
    const isDark = document.documentElement.classList.contains('dark')
    const rgb = isDark ? '255,255,255' : '0,0,0'
    const layers: string[] = []
    let x = 0
    for (const seg of text.split(/(\s+)/)) {
        const w = ctx.measureText(seg).width
        if (seg.trim()) {
            const cx = padLeft + x + w / 2
            const hw = Math.max(w * 0.45, 8) * spread
            const stops = [
                { dx: 0,         rw: hw * 0.8,  rh: 7, a: 0.22 },
                { dx: hw * 0.45, rw: hw * 0.55, rh: 8, a: 0.18 },
                { dx: -hw * 0.4, rw: hw * 0.65, rh: 6, a: 0.16 },
                { dx: hw * 0.15, rw: hw * 0.9,  rh: 5, a: 0.14 },
            ]
            for (const l of stops) {
                const lx = ((cx + l.dx) / wrapWidth * 100).toFixed(2)
                layers.push(
                    `radial-gradient(ellipse ${Math.max(l.rw, 2).toFixed(1)}px ${l.rh}px at ${lx}% 100%, rgba(${rgb},${l.a.toFixed(3)}), transparent)`
                )
            }
        }
        x += w
    }
    return layers.join(', ')
}

export const DissolveInput = forwardRef<DissolveInputHandle, Props>(function DissolveInput(
    { value, onChange, onEnter, placeholder, className },
    ref,
) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const mirrorRef = useRef<HTMLDivElement>(null)
    const fakePhRef = useRef<HTMLDivElement>(null)
    const glowRef = useRef<HTMLDivElement>(null)
    const isClearing = useRef(false)

    useImperativeHandle(ref, () => ({
        dissolve(text: string) {
            const wrap = wrapRef.current
            const mirror = mirrorRef.current
            const fakePh = fakePhRef.current
            const glow = glowRef.current
            if (!wrap || !mirror || !fakePh || !glow || isClearing.current || !text) return

            // Reduced motion: skip the animation entirely (CSS also kills the glow).
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

            isClearing.current = true
            // Single-line snapshot of the sent text (newlines collapse — the
            // mirror is just a visual stand-in for the fly-up).
            mirror.textContent = text.replace(/\s+/g, ' ')
            const bg = buildGlowLayers(wrap.clientWidth || 280, mirror.textContent)
            // Everything below is inline styles only: the parent re-renders
            // (clearing its input state) while this plays, and React rewrites
            // className on the wrap — inline styles on these layers survive.

            const peakAt  = readNum('--glow-peak-at', 0.15)
            const opacity = readNum('--glow-opacity', 0.42)
            const total   = readMs('--clear-dur', 1000)
            const outDur  = readMs('--clear-out-dur', 400)
            const inDur   = readMs('--clear-in-dur', 400)
            const outFly  = readNum('--clear-out-fly', 12)
            const inFly   = readNum('--clear-in-fly', 12)
            const blurPx  = readNum('--clear-blur', 2)
            const glowDly = readMs('--glow-delay', 50)
            const eOut = makeEase(readEase('--clear-out-ease', 'cubic-bezier(0.22, 1, 0.36, 1)'))
            const eIn  = makeEase(readEase('--clear-in-ease',  'cubic-bezier(0.22, 1, 0.36, 1)'))

            mirror.style.opacity = '1'
            fakePh.style.transform = `translateY(-${inFly}px)`
            fakePh.style.opacity = '0.9'
            fakePh.style.filter = `blur(${blurPx}px)`
            glow.style.background = bg
            glow.style.opacity = '0'

            const start = performance.now()
            const tick = (now: number) => {
                const elapsed = now - start
                const p = Math.min(1, elapsed / total)
                // Outgoing text: fly down-and-away with blur
                const e = eOut(Math.min(1, elapsed / outDur))
                mirror.style.transform = `translateY(${(e * outFly).toFixed(1)}px)`
                mirror.style.opacity = (1 - e).toFixed(3)
                mirror.style.filter = `blur(${(e * blurPx).toFixed(1)}px)`
                // Incoming placeholder: settle back into place
                const pe = eIn(Math.min(1, elapsed / inDur))
                fakePh.style.transform = `translateY(${(-inFly + pe * inFly).toFixed(1)}px)`
                fakePh.style.opacity = (0.9 + pe * 0.1).toFixed(3)
                fakePh.style.filter = `blur(${(blurPx - pe * blurPx).toFixed(1)}px)`
                // Glow streak: fast rise to the peak, slow fall after
                let g = 0
                if (elapsed > glowDly) {
                    const remaining = Math.max(1, total - glowDly)
                    const gp = Math.min(1, (elapsed - glowDly) / remaining)
                    g = gp < peakAt ? gp / peakAt : 1 - (gp - peakAt) / (1 - peakAt)
                }
                glow.style.opacity = (g * opacity).toFixed(3)

                if (p < 1) requestAnimationFrame(tick)
                else {
                    mirror.style.cssText = ''
                    fakePh.style.cssText = ''
                    mirror.textContent = ''
                    glow.style.opacity = '0'
                    glow.style.background = ''
                    isClearing.current = false
                }
            }
            requestAnimationFrame(tick)
        },
    }))

    return (
        <div
            ref={wrapRef}
            className={`t-clear rounded-2xl ${value ? 'has-value' : ''} ${className ?? ''}`}
        >
            {/* No native placeholder — the .t-clear-placeholder layer plays
                that role so it can fly back in during the dissolve. */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        onEnter()
                    }
                }}
                rows={1}
                className="w-full resize-none rounded-2xl border-[1.5px] border-input bg-card px-4 py-3 text-[14px] text-foreground
                           focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15
                           transition-all max-h-32"
                style={{ minHeight: 48 }}
            />
            <div ref={mirrorRef} className="t-clear-mirror" aria-hidden="true" />
            <div ref={fakePhRef} className="t-clear-placeholder" aria-hidden="true">{placeholder}</div>
            <div ref={glowRef} className="t-clear-glow" aria-hidden="true" />
        </div>
    )
})
