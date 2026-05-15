'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'

type Notification = {
    id: string
    type: string
    title: string
    body: string | null
    read: boolean
    created_at: string
}

const TYPE_ICON: Record<string, string> = {
    meal_reminder:       '🍽',
    macro_alert:         '💪',
    weekly_recap:        '📊',
    ippt_reminder:       '🏃',
    leaderboard_movement:'📈',
    nutrition_tip:       '💡',
    info:                'ℹ️',
}

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}d ago`
    return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

function CheckAllIcon() {
    return (
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

function ChevronDown({ open }: { open: boolean }) {
    return (
        <svg
            viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className={cn('transition-transform duration-200 flex-shrink-0', open && 'rotate-180')}
        >
            <path d="M6 9l6 6 6-6" />
        </svg>
    )
}

function NotifRow({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false)
    const hasMore = notif.body && notif.body.length > 80
    const icon = TYPE_ICON[notif.type] ?? 'ℹ️'

    function handleExpand() {
        setExpanded(e => !e)
        if (!notif.read) onRead(notif.id)
    }

    return (
        <div
            className={cn(
                'px-4 py-4 border-b border-border/50 last:border-0 transition-colors',
                !notif.read && 'bg-primary/5',
            )}
        >
            <button
                onClick={handleExpand}
                className="w-full text-left flex items-start gap-3 group"
            >
                {/* unread dot */}
                <div className="mt-1 flex-shrink-0 w-5 flex items-center justify-center">
                    {!notif.read
                        ? <div className="w-2 h-2 rounded-full bg-primary" />
                        : <span className="text-base leading-none">{icon}</span>
                    }
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="text-[14px] font-semibold text-foreground leading-snug">
                            {!notif.read && <span className="mr-1.5">{icon}</span>}
                            {notif.title}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                            <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">{timeAgo(notif.created_at)}</span>
                            {notif.body && <ChevronDown open={expanded} />}
                        </div>
                    </div>

                    {/* body — collapsed preview or full */}
                    {notif.body && (
                        <div className={cn(
                            'text-[13px] text-muted-foreground mt-1 leading-relaxed',
                            !expanded && hasMore && 'line-clamp-2',
                        )}>
                            {notif.body}
                        </div>
                    )}
                </div>
            </button>
        </div>
    )
}

export default function NotificationsPage() {
    const { user } = useAuth()
    const [items, setItems] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [markingAll, setMarkingAll] = useState(false)

    const load = useCallback(async () => {
        if (!user) return
        const res = await fetch(`/api/notifications?userId=${user.id}&limit=100`)
        const data = await res.json()
        setItems(data ?? [])
        setLoading(false)
    }, [user])

    useEffect(() => { load() }, [load])

    async function markAllRead() {
        if (!user) return
        setMarkingAll(true)
        await fetch(`/api/notifications?userId=${user.id}`, { method: 'PATCH' })
        setItems(prev => prev.map(n => ({ ...n, read: true })))
        setMarkingAll(false)
    }

    async function markOneRead(id: string) {
        setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    }

    const unread = items.filter(n => !n.read).length

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-2xl mx-auto px-4 py-8 pb-32 md:pb-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="font-display text-2xl font-bold text-foreground">Notifications</h1>
                        {unread > 0 && (
                            <p className="text-[13px] text-muted-foreground mt-0.5">{unread} unread</p>
                        )}
                    </div>
                    {unread > 0 && (
                        <button
                            onClick={markAllRead}
                            disabled={markingAll}
                            className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                        >
                            <CheckAllIcon />
                            Mark all read
                        </button>
                    )}
                </div>

                {/* List */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    {loading && (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        </div>
                    )}

                    {!loading && items.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            <p className="text-[14px]">No notifications yet</p>
                        </div>
                    )}

                    {!loading && items.map(n => (
                        <NotifRow key={n.id} notif={n} onRead={markOneRead} />
                    ))}
                </div>
            </div>
        </div>
    )
}
