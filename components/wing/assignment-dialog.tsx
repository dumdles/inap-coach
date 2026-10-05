'use client'

// Move a cadet to another section or wing (instructors: own wing only; the
// server re-checks in /api/cadet-admin). Opened from the roster and section
// pop-up on My Wing (app/dashboard/wing).

import React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { WingCadet } from '@/lib/wing-overview'

export type AdminAction = 'remove_section' | 'assign_section' | 'transfer_wing'

type AssignmentDialogProps = {
    cadet: WingCadet | null
    currentWing: string
    availableWings: string[]
    transferSection: string
    transferWing: string
    adminWorking: boolean
    onTransferSectionChange: (value: string) => void
    onTransferWingChange: (value: string) => void
    onAction: (cadetId: string, action: AdminAction) => void
    onClose: () => void
}

export function AssignmentDialog({
    cadet,
    currentWing,
    availableWings,
    transferSection,
    transferWing,
    adminWorking,
    onTransferSectionChange,
    onTransferWingChange,
    onAction,
    onClose,
}: AssignmentDialogProps) {
    return (
        <Dialog open={Boolean(cadet)} onOpenChange={open => { if (!open) onClose() }}>
            <DialogContent className="gap-5 rounded-2xl sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Manage assignment</DialogTitle>
                    <DialogDescription>
                        {cadet ? `${cadet.rank} ${cadet.full_name} · ${cadet.platoon ?? 'No platoon'}${cadet.section ? ` · Section ${cadet.section}` : ''}` : 'Update cadet assignment.'}
                    </DialogDescription>
                </DialogHeader>

                {cadet && (
                    <div className="grid gap-4">
                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Section{cadet.section ? ` · currently Sec ${cadet.section}` : ''}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <Select value={transferSection} onValueChange={onTransferSectionChange}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select section..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['1', '2', '3', '4'].map(s => (
                                            <SelectItem key={s} value={s}>Section {s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={() => onAction(cadet.id, 'assign_section')}
                                    disabled={adminWorking || !transferSection}
                                    isLoading={adminWorking && Boolean(transferSection)}
                                    className="w-full sm:w-auto"
                                >
                                    Assign
                                </Button>
                            </div>
                            {cadet.section && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onAction(cadet.id, 'remove_section')}
                                    disabled={adminWorking}
                                    className="mt-3 text-muted-foreground"
                                >
                                    Remove from section
                                </Button>
                            )}
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Transfer wing</p>
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <Select value={transferWing} onValueChange={onTransferWingChange}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select wing..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableWings.filter(w => w !== currentWing).map(w => (
                                            <SelectItem key={w} value={w}>{w} Wing</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={() => onAction(cadet.id, 'transfer_wing')}
                                    disabled={adminWorking || !transferWing}
                                    isLoading={adminWorking && Boolean(transferWing)}
                                    className="w-full sm:w-auto"
                                >
                                    Transfer
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={adminWorking}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
