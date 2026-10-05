'use client'

// "Jump to cadet…" — for instructors who know who they're looking for. Type a
// name (or "p2 s3"), arrow keys + Enter to pick; Ctrl/⌘ K focuses it from
// anywhere on My Wing.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { matchesQuery, type WingCadet } from '@/lib/wing-overview'
import { Avatar, GoalBadge, unitLabel } from '@/components/wing/shared'

export function CadetSearch({ cadets, onPick }: { cadets: WingCadet[]; onPick: (c: WingCadet) => void }) {
    const input = useRef<HTMLInputElement>(null)
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(0)
    const results = useMemo(() => query.trim() ? cadets.filter(c => matchesQuery(c, query)).slice(0, 8) : [], [cadets, query])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus() }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    function pick(c: WingCadet) {
        onPick(c)
        setQuery(''); setOpen(false); input.current?.blur()
    }

    return (
        <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input ref={input} value={query}
                onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true) }}
                onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
                onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
                    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]) }
                    else if (e.key === 'Escape') { setQuery(''); input.current?.blur() }
                }}
                role="combobox" aria-expanded={open && results.length > 0} aria-controls="cadet-search-results" aria-autocomplete="list"
                aria-label="Jump to cadet" placeholder="Jump to cadet…"
                className="w-full h-9 rounded-full border border-border bg-card pl-9 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-sans border border-border rounded px-1">⌘K</kbd>
            {open && query.trim() && (
                <ul id="cadet-search-results" role="listbox"
                    className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg p-1 max-h-80 overflow-y-auto">
                    {results.length === 0 ? (
                        <li className="px-3 py-2 text-[12px] text-muted-foreground">No cadet matches “{query}”</li>
                    ) : results.map((c, i) => (
                        <li key={c.id} role="option" aria-selected={i === active}
                            onMouseDown={e => { e.preventDefault(); pick(c) }} onMouseEnter={() => setActive(i)}
                            className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer', i === active && 'bg-muted dark:bg-background')}>
                            <Avatar name={c.full_name} size={26} />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium text-foreground">{c.full_name}</span>
                                <span className="block text-[11px] text-muted-foreground">{unitLabel(c)} · {c.score} pts</span>
                            </span>
                            <GoalBadge mode={c.goal_mode} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
