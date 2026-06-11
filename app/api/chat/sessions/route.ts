import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/app/api/_lib/auth'
import { supabaseAdmin } from '@/app/api/cron/_lib'

/**
 * Chat session management for the AI coach.
 *   GET            → list the cadet's sessions (newest first)
 *   GET ?id=<uuid> → messages for one session (as stored UIMessages)
 *   POST           → create a session ({ title? }) and return it
 *   DELETE ?id=    → delete a session (messages cascade)
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req)
    if ('error' in auth) return auth.error
    const userId = auth.user.id

    const sessionId = req.nextUrl.searchParams.get('id')

    if (sessionId) {
        const { data: session } = await supabaseAdmin
            .from('chat_sessions')
            .select('id, user_id')
            .eq('id', sessionId)
            .single()
        if (!session || session.user_id !== userId) {
            return NextResponse.json({ error: 'session not found' }, { status: 404 })
        }
        const { data: messages } = await supabaseAdmin
            .from('chat_messages')
            .select('id, role, parts')
            .eq('session_id', sessionId)
            .order('seq', { ascending: true })
        return NextResponse.json({ messages: messages ?? [] })
    }

    const { data: sessions } = await supabaseAdmin
        .from('chat_sessions')
        .select('id, title, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(30)
    return NextResponse.json({ sessions: sessions ?? [] })
}

export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req)
    if ('error' in auth) return auth.error

    const body = await req.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title.slice(0, 80) : null

    const { data, error } = await supabaseAdmin
        .from('chat_sessions')
        .insert({ user_id: auth.user.id, title })
        .select('id, title, created_at')
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
    const auth = await verifyAuth(req)
    if ('error' in auth) return auth.error

    const sessionId = req.nextUrl.searchParams.get('id')
    if (!sessionId) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await supabaseAdmin
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', auth.user.id)
    return NextResponse.json({ ok: true })
}
