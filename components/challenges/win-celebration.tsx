'use client'

// ── Win celebration ───────────────────────────────────────────────────────────
// Shown on a finished challenge where the cadet earned a place. Podium finishes
// get confetti the first time they open the result (remembered per device), and
// everyone with a final place can share a story-sized PNG of it — via the phone's
// share sheet (Instagram story, WhatsApp, Telegram…) or as a download.
// Image drawing: lib/share-card.ts.

import React, { useEffect, useState } from 'react'
import { Download, Share2, PartyPopper } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PlaceBadge } from '@/components/challenges/charts'
import { downloadBlob, drawShareCard, shareOrDownload, type ShareCardInput } from '@/lib/share-card'

/** Fire a short burst of confetti (lazy-loaded; respects reduced motion). */
export async function fireConfetti() {
    const confetti = (await import('canvas-confetti')).default
    // Medal + brand colours from the theme tokens (canvas needs real colour values).
    const css = getComputedStyle(document.documentElement)
    const colors = ['--medal-gold', '--medal-silver', '--medal-bronze', '--primary', '--viz-accent']
        .map(v => css.getPropertyValue(v).trim()).filter(c => c.startsWith('#'))
    const opts = { disableForReducedMotion: true, zIndex: 60, ...(colors.length ? { colors } : {}) }
    confetti({ ...opts, particleCount: 120, spread: 80, origin: { y: 0.35 } })
    setTimeout(() => confetti({ ...opts, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } }), 250)
    setTimeout(() => confetti({ ...opts, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } }), 400)
}

export function WinCelebration({ challengeId, card, points, alwaysCelebrate = false }: {
    challengeId: string
    card: ShareCardInput
    points: number | null      // bonus points earned (podium only)
    alwaysCelebrate?: boolean  // demo mode: confetti every time
}) {
    const podium = card.place <= 3
    const [open, setOpen] = useState(false)
    // The generated PNG (made once, on first open) and its preview URL.
    const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
    const [busy, setBusy] = useState(false)

    // Confetti once per challenge per device (localStorage may be unavailable — then just once per visit).
    useEffect(() => {
        if (!podium) return
        const key = `celebrated:${challengeId}`
        try {
            if (!alwaysCelebrate && localStorage.getItem(key)) return
            localStorage.setItem(key, '1')
        } catch { /* private mode etc. */ }
        void fireConfetti()
    }, [challengeId, podium, alwaysCelebrate])

    // Revoke the preview URL when it changes / on unmount.
    useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])

    async function openShare() {
        setOpen(true)
        if (image) return
        setBusy(true)
        try {
            const blob = await drawShareCard(card)
            setImage({ blob, url: URL.createObjectURL(blob) })
        } catch {
            toast.error('Could not create the image')
        } finally { setBusy(false) }
    }

    const filename = `fitrep-${card.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`
    const text = `I placed ${card.place === 1 ? '1st' : card.place === 2 ? '2nd' : card.place === 3 ? '3rd' : `${card.place}th`} in "${card.title}" on FitRep 💪`

    return (
        <section className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center gap-4">
            <PlaceBadge place={card.place} size={56} />
            <div className="flex-1 min-w-[200px]">
                <div className="font-display font-extrabold text-[22px] text-foreground leading-tight">
                    {podium ? `You placed ${ordinalWord(card.place)}!` : `You finished ${ordinalWord(card.place)} of ${card.of}`}
                </div>
                <div className="text-[13px] text-muted-foreground mt-0.5">
                    {points ? `+${points} bonus points added to your leaderboard score.` : 'Nice work — share your result with your section.'}
                </div>
            </div>
            <div className="flex gap-2">
                {podium && (
                    <Button variant="outline" onClick={() => void fireConfetti()} aria-label="Celebrate again"><PartyPopper size={16} /></Button>
                )}
                <Button onClick={openShare}><Share2 size={16} /> Share result</Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Share your result</DialogTitle>
                        <DialogDescription>Story-sized image (1080×1920) — post it to Instagram or send it to your section.</DialogDescription>
                    </DialogHeader>
                    <div className="mx-auto w-[220px] aspect-[9/16] rounded-xl overflow-hidden bg-muted dark:bg-background">
                        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                        {image ? <img src={image.url} alt={`Share card: ${text}`} className="w-full h-full object-cover" />
                            : <div className="w-full h-full animate-pulse" />}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" disabled={!image || busy}
                            onClick={() => image && downloadBlob(image.blob, filename)}>
                            <Download size={16} /> Download PNG
                        </Button>
                        <Button disabled={!image || busy} onClick={async () => {
                            if (!image) return
                            const how = await shareOrDownload(image.blob, filename, text)
                            if (how === 'downloaded') toast.success('Image saved — add it to your story from your photos')
                        }}>
                            <Share2 size={16} /> Share
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    )
}

function ordinalWord(n: number) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th` }
