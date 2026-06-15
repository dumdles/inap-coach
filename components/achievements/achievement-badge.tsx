'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { type Achievement, ACHIEVEMENT_MAP } from '@/lib/achievements'

// Tailwind gradient per rarity — applied to the icon container background.
const RARITY_GRADIENT: Record<string, string> = {
    common:    'from-slate-400 to-slate-600',
    rare:      'from-blue-400 to-blue-600',
    epic:      'from-violet-500 to-purple-700',
    legendary: 'from-amber-400 to-orange-500',
}

// Extra ring glow for epic / legendary badges.
const RARITY_RING: Record<string, string> = {
    common:    '',
    rare:      '',
    epic:      'ring-1 ring-violet-500/50',
    legendary: 'ring-2 ring-amber-500/60',
}

// ── Small badge ──────────────────────────────────────────────────────────────
// Used inline in leaderboard rows — shows only the icon in a small circle.
export function AchievementBadgeSm({
    achievementId,
    className,
}: {
    achievementId: string
    className?: string
}) {
    const a = ACHIEVEMENT_MAP[achievementId]
    if (!a) return null

    return (
        <span
            className={cn(
                'inline-flex w-[22px] h-[22px] rounded-full items-center justify-center text-[11px] flex-shrink-0',
                `bg-gradient-to-br ${RARITY_GRADIENT[a.rarity]}`,
                RARITY_RING[a.rarity],
                className,
            )}
            title={`${a.name}: ${a.description}`}
            aria-label={a.name}
        >
            {a.icon}
        </span>
    )
}

// ── Full badge ───────────────────────────────────────────────────────────────
// Used in the profile achievements grid — icon square + name label below.
export function AchievementBadge({
    achievement,
    unlocked,
    className,
}: {
    achievement: Achievement
    unlocked: boolean
    className?: string
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center gap-1.5 p-2 rounded-xl select-none cursor-default',
                !unlocked && 'opacity-30 grayscale',
                className,
            )}
            title={
                unlocked
                    ? `${achievement.name} — ${achievement.description}`
                    : `Locked: ${achievement.description}`
            }
        >
            {/* Icon circle */}
            <div
                className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm',
                    unlocked
                        ? `bg-gradient-to-br ${RARITY_GRADIENT[achievement.rarity]} ${RARITY_RING[achievement.rarity]}`
                        : 'bg-muted',
                )}
            >
                {achievement.icon}
            </div>

            {/* Name */}
            <span className="text-[10px] font-medium text-center text-foreground leading-tight line-clamp-2 max-w-[68px]">
                {achievement.name}
            </span>
        </div>
    )
}

// ── Rarity pill ──────────────────────────────────────────────────────────────
// Optional label chip — e.g. used in tooltips or detail views.
const RARITY_PILL: Record<string, string> = {
    common:    'bg-slate-500/15 text-slate-400',
    rare:      'bg-blue-500/15 text-blue-400',
    epic:      'bg-violet-500/15 text-violet-400',
    legendary: 'bg-amber-500/15 text-amber-400',
}

export function RarityPill({ rarity }: { rarity: string }) {
    return (
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', RARITY_PILL[rarity] ?? '')}>
            {rarity}
        </span>
    )
}
