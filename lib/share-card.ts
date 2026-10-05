// ── Shareable result card (PNG) ───────────────────────────────────────────────
// Draws a 1080×1920 (Instagram story) image of a challenge result on a canvas
// and shares it (native share sheet → Instagram, WhatsApp, Telegram…) or
// downloads it. Colours and fonts are read from the app's CSS tokens at runtime
// so the card matches the theme — canvas can't use CSS variables directly.
// Used by components/challenges/win-celebration.tsx.

export type ShareCardInput = {
    place: number          // 1, 2, 3 (or any final place)
    of: number             // out of how many cadets/teams
    title: string          // challenge title
    scoreLabel: string     // e.g. "750 reps"
    points: number | null  // bonus points earned (null = none)
    name: string           // cadet name, e.g. "OCT Tan Wei Jie"
    metricLabel: string    // e.g. "Reps"
    dateLabel: string      // e.g. "3 Oct 2026"
}

const W = 1080, H = 1920
// Instagram/WhatsApp stories overlay the top and bottom ~250px with their own UI,
// so the important content sits between y≈280 and y≈1700.

/** Read a CSS custom property from :root, with a fallback for SSR/tests. */
function token(name: string, fallback: string) {
    if (typeof window === 'undefined') return fallback
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Colour with alpha. Tokens are #RRGGBB hex; anything else falls back to the colour as-is. */
function alpha(color: string, a: number) {
    const m = /^#([0-9a-f]{6})$/i.exec(color)
    if (!m) return color
    const n = parseInt(m[1], 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function ordinal(n: number) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th` }

/** Word-wrap text into lines that fit `maxWidth`, at most `maxLines` (last one ellipsised). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
    const words = text.split(/\s+/), lines: string[] = []
    let line = ''
    for (const w of words) {
        const next = line ? `${line} ${w}` : w
        if (ctx.measureText(next).width <= maxWidth || !line) line = next
        else { lines.push(line); line = w }
    }
    if (line) lines.push(line)
    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines)
        let last = kept[maxLines - 1]
        while (ctx.measureText(last + '…').width > maxWidth && last.length) last = last.slice(0, -1)
        kept[maxLines - 1] = last + '…'
        return kept
    }
    return lines
}

export async function drawShareCard(input: ShareCardInput): Promise<Blob> {
    // Make sure the display font (Satoshi) is loaded before drawing text.
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready
    const display = `${token('--font-display', "'Satoshi', sans-serif")}`
    const body = `${token('--font-sans', 'system-ui, sans-serif')}, system-ui, sans-serif`
    const medals = [token('--medal-gold', '#E0A526'), token('--medal-silver', '#A5ADBA'), token('--medal-bronze', '#B86A3A')]
    const medal = medals[input.place - 1] ?? token('--viz-accent', '#3987e5')
    const primary = token('--primary', '#0052CC')
    const ink = '#FFFFFF'

    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Background: deep navy → brand primary glow at the top.
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0B1B3A'); bg.addColorStop(1, '#050B18')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 640, 760)
    glow.addColorStop(0, alpha(primary, 0.4)); glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

    // Confetti dots (deterministic so the image is stable).
    let seed = input.title.length * 97 + input.place
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const dots = [medal, primary, ...medals]
    for (let i = 0; i < 70; i++) {
        ctx.save()
        ctx.translate(rnd() * W, 120 + rnd() * 900)
        ctx.rotate(rnd() * Math.PI)
        ctx.globalAlpha = 0.35 + rnd() * 0.5
        ctx.fillStyle = dots[i % dots.length]
        ctx.fillRect(-9, -4, 18, 8)
        ctx.restore()
    }
    ctx.globalAlpha = 1

    // Header
    ctx.textAlign = 'center'
    ctx.fillStyle = ink
    ctx.font = `700 40px ${body}`
    ctx.globalAlpha = 0.7
    ctx.fillText(input.place <= 3 ? 'PODIUM FINISH' : 'CHALLENGE COMPLETE', W / 2, 300)
    ctx.globalAlpha = 1

    // Medal
    const cx = W / 2, cy = 640, r = 210
    ctx.beginPath(); ctx.arc(cx, cy, r + 26, 0, Math.PI * 2); ctx.fillStyle = alpha(medal, 0.2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#0B1B3A'; ctx.fill()
    ctx.lineWidth = 22; ctx.strokeStyle = medal; ctx.stroke()
    ctx.fillStyle = ink
    ctx.font = `900 220px ${display}`
    ctx.textBaseline = 'middle'
    ctx.fillText(String(input.place), cx, cy + 12)
    ctx.textBaseline = 'alphabetic'

    // Place line
    ctx.font = `900 110px ${display}`
    ctx.fillText(`${ordinal(input.place)} place`, W / 2, 1000)
    ctx.font = `500 44px ${body}`
    ctx.globalAlpha = 0.75
    ctx.fillText(`out of ${input.of}`, W / 2, 1062)
    ctx.globalAlpha = 1

    // Challenge title
    ctx.font = `800 64px ${display}`
    const lines = wrap(ctx, input.title, W - 200, 2)
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 1185 + i * 76))

    // Stat pills
    const pillY = 1185 + lines.length * 76 + 30
    const pills = [input.scoreLabel, input.points ? `+${input.points} bonus pts` : input.metricLabel]
    ctx.font = `700 44px ${body}`
    const pw = pills.map(p => ctx.measureText(p).width + 80)
    let px = W / 2 - (pw[0] + pw[1] + 30) / 2
    pills.forEach((p, i) => {
        ctx.fillStyle = i === 1 && input.points ? medal : 'rgba(255,255,255,0.12)'
        roundRect(ctx, px, pillY, pw[i], 96, 48); ctx.fill()
        ctx.fillStyle = i === 1 && input.points ? '#0B1B3A' : ink
        ctx.fillText(p, px + pw[i] / 2, pillY + 63)
        px += pw[i] + 30
    })

    // Footer
    ctx.fillStyle = ink
    ctx.font = `700 48px ${body}`
    ctx.fillText(input.name, W / 2, H - 360)
    ctx.globalAlpha = 0.6
    ctx.font = `500 36px ${body}`
    ctx.fillText(input.dateLabel, W / 2, H - 305)
    ctx.globalAlpha = 1
    ctx.font = `900 56px ${display}`
    ctx.fillText('FitRep', W / 2, H - 220)

    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png'))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

/**
 * Share the PNG through the native share sheet when the device supports sharing
 * files (iOS/Android → Instagram story, WhatsApp, Telegram…); otherwise download it.
 * Returns how it was handled.
 */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
    const file = new File([blob], filename, { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (nav.canShare?.({ files: [file] })) {
        try { await nav.share({ files: [file], text }); return 'shared' }
        catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled' } // fall through to download on other errors
    }
    downloadBlob(blob, filename)
    return 'downloaded'
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
