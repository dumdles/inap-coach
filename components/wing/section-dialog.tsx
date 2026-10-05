'use client'

// A section's cadets in a pop-up — opened from the wing map (section header or
// a cadet's square, which is then highlighted) and from the attention list.

import React, { useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { platoonLabel, type SectionGroup, type WingCadet } from '@/lib/wing-overview'
import { RosterHeader, RosterRow } from '@/components/wing/roster'

export function SectionDialog({ section, highlightId, onClose, onManage }: {
    section: SectionGroup | null
    highlightId?: string | null
    onClose: () => void
    onManage?: (c: WingCadet) => void
}) {
    // Bring the clicked cadet into view.
    useEffect(() => {
        if (!section || !highlightId) return
        const t = setTimeout(() => document.getElementById(`cadet-${highlightId}`)?.scrollIntoView({ block: 'nearest' }), 150)
        return () => clearTimeout(t)
    }, [section, highlightId])

    return (
        <Dialog open={!!section} onOpenChange={o => { if (!o) onClose() }}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                {section && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-[17px]">{platoonLabel(section.platoon)} · {section.label}</DialogTitle>
                            <DialogDescription className="tabular-nums">
                                {section.stats.count} cadets · {section.stats.loggedToday} logged today · avg score {section.stats.avgScore}
                                {section.stats.silent > 0 && ` · ${section.stats.silent} silent 3+ days`}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="-mx-2">
                            <RosterHeader />
                            {section.cadets.map(c => <RosterRow key={c.id} c={c} highlight={c.id === highlightId} onManage={onManage} />)}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
