import { NextRequest, NextResponse } from 'next/server'
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { verifyAuth } from '@/app/api/_lib/auth'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { chatModel } from '@/app/api/_lib/ai'
import { buildChatSystemPrompt } from '@/app/api/_lib/coach-prompt'
import { getCoachProfile } from '@/app/api/_lib/coach-data'
import { buildCoachTools } from '@/app/api/_lib/coach-tools'

// Keep conversations bounded: only the most recent messages go to the model.
// Older turns are still stored and rendered, just not re-sent as context.
const MAX_CONTEXT_MESSAGES = 20

/**
 * Streaming AI coach chat. The client (useChat) POSTs the full UIMessage
 * history plus a sessionId; we stream the response back and persist the
 * final message list for the session when the stream finishes.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req)
    if ('error' in auth) return auth.error
    const userId = auth.user.id

    const { messages, sessionId }: { messages: UIMessage[]; sessionId?: string } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
        return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }
    if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    // Confirm the session belongs to the authed cadet before writing to it.
    const { data: session } = await supabaseAdmin
        .from('chat_sessions')
        .select('id, user_id')
        .eq('id', sessionId)
        .single()
    if (!session || session.user_id !== userId) {
        return NextResponse.json({ error: 'session not found' }, { status: 404 })
    }

    const profile = await getCoachProfile(userId)
    if (!profile) return NextResponse.json({ error: 'user not found' }, { status: 404 })

    const recent = messages.slice(-MAX_CONTEXT_MESSAGES)

    const result = streamText({
        model: chatModel(),
        system: buildChatSystemPrompt(profile),
        messages: await convertToModelMessages(recent),
        tools: buildCoachTools(userId),
        // Allow tool-call → result → answer loops (e.g. fetch nutrition, then
        // fetch sleep, then write the reply) before generation stops.
        stopWhen: stepCountIs(6),
        temperature: 0.5,
        maxOutputTokens: 1200,
    })

    return result.toUIMessageStreamResponse({
        originalMessages: messages,
        onFinish: async ({ messages: finalMessages }) => {
            // Replace-and-reinsert keeps the stored history exactly in sync
            // with what the client shows, including tool-call parts.
            await supabaseAdmin.from('chat_messages').delete().eq('session_id', sessionId)
            const rows = finalMessages.map((m, i) => ({
                session_id: sessionId,
                role: m.role,
                parts: m.parts,
                seq: i,
            }))
            if (rows.length) await supabaseAdmin.from('chat_messages').insert(rows)
            await supabaseAdmin
                .from('chat_sessions')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', sessionId)
        },
        onError: (err) => {
            console.error('[chat] stream error:', err)
            return 'The coach hit a snag answering that — please try again.'
        },
    })
}
