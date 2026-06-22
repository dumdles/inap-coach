'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Shimmer } from '@/components/ui/shimmer'
import { DissolveInput, type DissolveInputHandle } from '@/components/coach/dissolve-input'
import { toast } from 'sonner'
import {
    Sparkles, SendHorizontal, Plus, History, Trash2, Check, Loader2,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────

type ChatSession = { id: string; title: string | null; updated_at: string }

// Friendly labels for the data tools the coach calls mid-answer, so the cadet
// sees "Checked sleep data" instead of a raw tool name.
const TOOL_LABELS: Record<string, string> = {
    getNutritionSummary: 'Checked nutrition logs',
    getMeals: 'Looked up logged meals',
    getWorkouts: 'Checked workout history',
    getWeightTrend: 'Checked weight trend',
    getSleep: 'Checked sleep data',
    getLeaderboard: 'Checked leaderboard scores',
    getIpptResults: 'Checked IPPT records',
    getTargets: 'Recalculated daily targets',
    setIpptDate: 'Saved your IPPT date',
}

// Pill widths for the starter-chip loading skeleton — varied so the row of
// placeholders looks like real questions rather than identical blocks.
const CHIP_SKELETON_WIDTHS = ['9rem', '12rem', '7.5rem', '10.5rem']

// Starter chips shown on the empty state before the first message.
const STARTER_CHIPS = [
    "How's my protein been this week?",
    'Am I on track for my weight goal?',
    'What should I eat before PT tomorrow?',
    'How can I sleep better in camp?',
]

/** Concatenated text content of a UIMessage (ignores tool/reasoning parts). */
function textOf(message: UIMessage): string {
    return message.parts
        .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
        .map(p => p.text)
        .join('')
}

function timeAgo(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

// ── Markdown (assistant bubbles) ───────────────────────────

function CoachMarkdown({ text }: { text: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                p:  ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-4 space-y-1 list-disc marker:text-muted-foreground">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-4 space-y-1 list-decimal marker:text-muted-foreground">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                a:  ({ children, href }) => <a href={href} className="text-primary underline underline-offset-2">{children}</a>,
                code: ({ children }) => <code className="px-1 py-0.5 rounded bg-muted text-[12px] font-mono">{children}</code>,
                h1: ({ children }) => <p className="font-semibold mb-1.5">{children}</p>,
                h2: ({ children }) => <p className="font-semibold mb-1.5">{children}</p>,
                h3: ({ children }) => <p className="font-semibold mb-1.5">{children}</p>,
            }}
        >
            {text}
        </ReactMarkdown>
    )
}

// ── Message bubbles ────────────────────────────────────────

function ToolChip({ name, done }: { name: string; done: boolean }) {
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-medium">
            {done
                ? <Check size={11} className="text-success" />
                : <Loader2 size={11} className="animate-spin" />}
            {TOOL_LABELS[name] ?? `Checked ${name}`}
        </span>
    )
}

function AssistantMessage({ message }: { message: UIMessage }) {
    // Group consecutive tool parts so chips sit in one row above the text.
    const toolParts = message.parts.filter(isToolUIPart)
    const text = textOf(message)

    return (
        <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles size={13} className="text-primary" />
            </div>
            <div className="min-w-0 max-w-[85%] space-y-1.5">
                {toolParts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {toolParts.map(part => (
                            <ToolChip
                                key={part.toolCallId}
                                name={part.type.replace('tool-', '')}
                                done={part.state === 'output-available' || part.state === 'output-error'}
                            />
                        ))}
                    </div>
                )}
                {text && (
                    <div className="rounded-2xl rounded-tl-md bg-card border border-border px-4 py-3 text-[14px] text-foreground">
                        <CoachMarkdown text={text} />
                    </div>
                )}
            </div>
        </div>
    )
}

function UserMessage({ message }: { message: UIMessage }) {
    return (
        <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary text-primary-foreground px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
                {textOf(message)}
            </div>
        </div>
    )
}

function TypingIndicator() {
    return (
        <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles size={13} className="text-primary" />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-card border border-border px-4 py-3 text-[13px]">
                <Shimmer>Generating response…</Shimmer>
            </div>
        </div>
    )
}

// ── Suggestion chips ───────────────────────────────────────

function SuggestionChips({ chips, onPick, disabled }: {
    chips: string[]
    onPick: (text: string) => void
    disabled: boolean
}) {
    if (!chips.length) return null
    return (
        // Single scrollable row on mobile (so 2-3 wordy suggestions don't wrap
        // into a second line and eat into the chat bubble area); wraps normally
        // once there's enough width to spare on larger screens.
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible animate-in fade-in slide-in-from-bottom-1 duration-300">
            {chips.map(chip => (
                <button
                    key={chip}
                    onClick={() => onPick(chip)}
                    disabled={disabled}
                    className="shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full border border-primary/25 bg-primary/5 text-primary text-[13px] font-medium
                               hover:bg-primary/10 hover:border-primary/40 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {chip}
                </button>
            ))}
        </div>
    )
}

// The transport itself is static — auth and session id are supplied per
// request via sendMessage's request-level options (the AI SDK recommended way).
const chatTransport = new DefaultChatTransport({ api: '/api/chat' })

// ── Page ───────────────────────────────────────────────────

export default function CoachPage() {
    const { user, session } = useAuth()
    const [input, setInput] = useState('')
    const [chips, setChips] = useState<string[]>([])
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [historyOpen, setHistoryOpen] = useState(false)
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    // Empty-state chips: start empty and show a loading skeleton while the
    // profile-tailored questions are generated, then reveal them. Avoids the
    // jarring swap from static defaults to personalised ones. Static set is the
    // fallback if the request fails.
    const [starterChips, setStarterChips] = useState<string[]>([])
    const [chipsLoading, setChipsLoading] = useState(true)
    const suggestionsForRef = useRef<string | null>(null)
    const dissolveRef = useRef<DissolveInputHandle>(null)
    // Daily AI usage — how many coach messages the cadet has left today.
    const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null)

    const token = session?.access_token

    const { messages, sendMessage, setMessages, status, error } = useChat({ transport: chatTransport })
    const busy = status === 'submitted' || status === 'streaming'
    const limitReached = usage ? usage.remaining <= 0 : false

    const authHeaders = useCallback((): Record<string, string> => ({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    }), [token])

    // ── Daily AI usage ─────────────────────────────────────
    const refreshUsage = useCallback(() => {
        if (!token) return
        fetch('/api/chat/usage', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null)
            .then(u => { if (u) setUsage(u) })
            .catch(() => {})
    }, [token])

    useEffect(() => { refreshUsage() }, [refreshUsage])
    // Re-read the count whenever a turn settles (ready) or errors (a 429 from
    // the limit also lands here), so the indicator stays in sync.
    useEffect(() => { if (status === 'ready' || error) refreshUsage() }, [status, error, refreshUsage])

    // ── Session management ─────────────────────────────────

    const refreshSessions = useCallback(() => {
        if (!token) return
        fetch('/api/chat/sessions', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : { sessions: [] })
            .then(d => setSessions(d.sessions ?? []))
            .catch(() => {})
    }, [token])

    useEffect(() => { refreshSessions() }, [refreshSessions])

    // Personalised starter chips: ask the suggestions API (no conversation →
    // starter mode) for opening questions tailored to this cadet's profile.
    useEffect(() => {
        if (!token) return
        // chipsLoading starts true, so the skeleton shows from mount through
        // auth until this personalised fetch resolves — no flash of defaults.
        fetch('/api/chat/suggestions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        })
            .then(r => r.ok ? r.json() : { suggestions: [] })
            .then(({ suggestions }) => {
                // Use the personalised set, or fall back to the static defaults.
                setStarterChips(suggestions?.length ? suggestions : STARTER_CHIPS)
            })
            .catch(() => setStarterChips(STARTER_CHIPS))
            .finally(() => setChipsLoading(false))
    }, [token])

    /** Returns the active session id, creating a session on the first message. */
    async function ensureSession(firstMessage: string): Promise<string | null> {
        if (activeSessionId) return activeSessionId
        const res = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ title: firstMessage.slice(0, 80) }),
        })
        if (!res.ok) { toast.error('Could not start a chat — try again.'); return null }
        const { id } = await res.json()
        setActiveSessionId(id)
        refreshSessions()
        return id
    }

    async function loadSession(id: string) {
        setHistoryOpen(false)
        const res = await fetch(`/api/chat/sessions?id=${id}`, { headers: authHeaders() })
        if (!res.ok) { toast.error('Could not load that conversation.'); return }
        const { messages: stored } = await res.json()
        setActiveSessionId(id)
        suggestionsForRef.current = null
        setChips([])
        setMessages(stored.map((m: { id: string; role: UIMessage['role']; parts: UIMessage['parts'] }) => ({
            id: m.id, role: m.role, parts: m.parts,
        })))
    }

    async function deleteSession(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        await fetch(`/api/chat/sessions?id=${id}`, { method: 'DELETE', headers: authHeaders() })
        setSessions(prev => prev.filter(s => s.id !== id))
        if (activeSessionId === id) newChat()
    }

    function newChat() {
        setActiveSessionId(null)
        suggestionsForRef.current = null
        setChips([])
        setMessages([])
        setHistoryOpen(false)
    }

    // ── Sending ────────────────────────────────────────────

    async function handleSend(text: string) {
        const trimmed = text.trim()
        if (!trimmed || busy) return
        if (limitReached) {
            toast.error("You've used all your AI coach messages for today. Resets at midnight (SGT).")
            return
        }
        setChips([])
        // Dissolve the typed text out of the input (no-op for chip sends,
        // where the input is already empty).
        if (text === input) dissolveRef.current?.dissolve(trimmed)
        setInput('')
        const sessionId = await ensureSession(trimmed)
        if (!sessionId) return
        // Request-level options: the auth token and session id ride along with
        // this specific POST to /api/chat.
        sendMessage(
            { text: trimmed },
            { headers: { Authorization: `Bearer ${token}` }, body: { sessionId } },
        )
    }

    // ── Follow-up suggestion chips ─────────────────────────
    // When a coach reply finishes, ask the API for 3 quick replies the cadet
    // might tap next. Keyed by message id so we only fetch once per reply.

    useEffect(() => {
        if (status !== 'ready' || messages.length === 0) return
        const last = messages[messages.length - 1]
        if (last.role !== 'assistant' || !textOf(last)) return
        if (suggestionsForRef.current === last.id) return
        suggestionsForRef.current = last.id

        const conversation = messages.slice(-4)
            .map(m => `${m.role === 'user' ? 'Cadet' : 'Coach'}: ${textOf(m).slice(0, 600)}`)
            .join('\n\n')

        fetch('/api/chat/suggestions', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ conversation }),
        })
            .then(r => r.ok ? r.json() : { suggestions: [] })
            .then(({ suggestions }) => {
                // Ignore the result if the user has already moved on.
                if (suggestionsForRef.current === last.id) setChips(suggestions ?? [])
            })
            .catch(() => {})
    }, [status, messages, authHeaders])

    // ── Auto-scroll to the newest message ──────────────────

    const scrollRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, [messages, status])

    // ── Render ─────────────────────────────────────────────

    const firstName = (user?.user_metadata?.full_name as string | undefined)?.trim().split(' ')[0]

    return (
        <div className="flex flex-col h-[calc(100dvh-7rem)] md:h-dvh max-w-3xl mx-auto px-4 sm:px-6">
            {/* Header */}
            <div className="flex items-center justify-between pt-6 pb-4 flex-shrink-0">
                <div>
                    <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground leading-none flex items-center gap-2">
                        AI Coach
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
                            <Sparkles size={10} /> Beta
                        </span>
                    </h1>
                    <p className="text-[13px] text-muted-foreground mt-1">Ask anything about your nutrition, training and recovery</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={newChat}
                        title="New chat"
                        className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                    <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                        <PopoverTrigger asChild>
                            <button
                                title="Chat history"
                                className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                                <History size={15} />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" sideOffset={8} className="w-72 p-1.5 max-h-80 overflow-y-auto">
                            {sessions.length === 0 && (
                                <p className="text-[12px] text-muted-foreground text-center py-6">No past conversations</p>
                            )}
                            {sessions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => loadSession(s.id)}
                                    className={cn(
                                        'group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent transition-colors',
                                        activeSessionId === s.id && 'bg-primary/5',
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-medium text-foreground truncate">{s.title || 'Untitled chat'}</p>
                                        <p className="text-[11px] text-muted-foreground">{timeAgo(s.updated_at)}</p>
                                    </div>
                                    <button
                                        onClick={e => deleteSession(s.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                        title="Delete conversation"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4 scrollbar-hide">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-5 pb-10">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Sparkles size={24} className="text-primary" />
                        </div>
                        <div>
                            <p className="font-display text-lg font-bold text-foreground">
                                {firstName ? `Hey ${firstName}!` : 'Hey Cadet!'}
                            </p>
                            <p className="text-[13px] text-muted-foreground mt-1 max-w-xs">
                                I can see your logged meals, workouts, sleep and progress — ask me anything.
                            </p>
                        </div>
                        {chipsLoading ? (
                            <div className="flex flex-col items-center gap-2.5">
                                <Shimmer className="text-[12px]">Personalising suggestions…</Shimmer>
                                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                                    {CHIP_SKELETON_WIDTHS.map((w, i) => (
                                        <div
                                            key={i}
                                            className="chip-skeleton h-[37px]"
                                            style={{ width: w }}
                                            aria-hidden
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap justify-center gap-2 max-w-md">
                                {starterChips.map((chip, i) => (
                                    <button
                                        key={chip}
                                        onClick={() => handleSend(chip)}
                                        // Stagger each chip in so the personalised set arrives gracefully.
                                        style={{ animationDelay: `${i * 70}ms` }}
                                        className="px-3.5 py-2 rounded-full border border-border bg-card text-[13px] font-medium text-foreground
                                                   hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-[0.98] transition-all
                                                   animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {messages.map(message =>
                    message.role === 'user'
                        ? <UserMessage key={message.id} message={message} />
                        : <AssistantMessage key={message.id} message={message} />
                )}

                {status === 'submitted' && <TypingIndicator />}

                {error && (
                    <div className="flex items-center gap-2 text-[13px] text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
                        {limitReached
                            ? `You've reached your daily limit of ${usage?.limit} coach messages. It resets at midnight (SGT).`
                            : 'The coach hit a snag. Check your connection and try again.'}
                    </div>
                )}
            </div>

            {/* Follow-up chips + input */}
            <div className="flex-shrink-0 space-y-2 pt-1">
                {status === 'ready' && messages.length > 0 && (
                    <SuggestionChips chips={chips} onPick={handleSend} disabled={busy} />
                )}
                {limitReached && (
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground bg-muted/50 border border-border rounded-xl px-3.5 py-2.5">
                        <Sparkles size={13} className="text-primary flex-shrink-0" />
                        Daily AI coach limit reached. Your {usage?.limit} messages reset at midnight (SGT).
                    </div>
                )}
                <form
                    onSubmit={e => { e.preventDefault(); handleSend(input) }}
                    className="flex items-end gap-2"
                >
                    <DissolveInput
                        ref={dissolveRef}
                        value={input}
                        onChange={setInput}
                        onEnter={() => handleSend(input)}
                        placeholder={limitReached ? 'Daily limit reached — back tomorrow' : 'Ask your coach…'}
                        className="flex-1"
                        disabled={limitReached}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || busy || limitReached}
                        className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0
                                   hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                        title="Send"
                    >
                        {busy ? <Loader2 size={17} className="animate-spin" /> : <SendHorizontal size={17} />}
                    </button>
                </form>
                {/* Show the remaining count once the cadet is running low; otherwise the usual disclaimer. */}
                {usage && !limitReached && usage.remaining <= 5 ? (
                    <p className="text-[11px] text-muted-foreground/70 text-center">
                        {usage.remaining} of {usage.limit} daily AI messages left
                    </p>
                ) : (
                    <p className="text-[11px] text-muted-foreground/70 text-center">
                        AI coach can make mistakes. For medical concerns, see your MO.
                    </p>
                )}
            </div>
        </div>
    )
}
