'use client'

// ── Reset password ────────────────────────────────────────────────────────────
// Step 2: the link in the reset email (sent from /auth/forgot-password) opens
// this page. Supabase signs the user in with a short-lived "recovery" session,
// and they choose a new password here (supabase.auth.updateUser).
//
// Two link styles are supported:
//   • Supabase's default email: …/auth/reset-password#access_token=…&type=recovery
//     — supabase-js reads (and clears) the hash on load; lib/supabase.ts keeps a
//     snapshot (initialAuthHash) so we can tell the page came from that link.
//   • A custom email template using ?token_hash=…&type=recovery — verified here
//     with verifyOtp (more robust against email scanners that pre-open links).
// The page refuses to change a password without one of these, so an ordinary
// signed-in session can't be used to change it without the current password.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, initialAuthHash } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input-field'
import { Alert } from '@/components/ui/alert'
import { AuthCard } from '@/components/auth/auth-card'

const MIN_LENGTH = 8 // same rule as sign-up and Settings → Change password

type Phase = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
    const router = useRouter()
    const [phase, setPhase] = useState<Phase>('checking')
    const [linkError, setLinkError] = useState('')
    const [form, setForm] = useState({ password: '', confirm: '' })
    const [touched, setTouched] = useState<Record<string, boolean>>({})
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Work out whether we arrived from a valid reset link.
    useEffect(() => {
        let cancelled = false
        const hash = new URLSearchParams(initialAuthHash.replace(/^#/, ''))
        const query = new URLSearchParams(window.location.search)
        const finish = (p: Phase, msg = '') => { if (!cancelled) { setLinkError(msg); setPhase(p) } }

        ;(async () => {
            // Expired / already-used link: Supabase redirects with #error=… (or ?error=…)
            const errDesc = hash.get('error_description') ?? query.get('error_description')
            if (errDesc) return finish('invalid', errDesc.replace(/\+/g, ' '))

            // Custom template link (?token_hash=…&type=recovery)
            const tokenHash = query.get('token_hash')
            if (tokenHash && query.get('type') === 'recovery') {
                const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
                return error ? finish('invalid', error.message) : finish('ready')
            }

            // Default link (#access_token=…&type=recovery): getSession() waits for
            // supabase-js to finish reading the hash, so the session is ready here.
            if (hash.get('type') === 'recovery') {
                const { data } = await supabase.auth.getSession()
                return data.session ? finish('ready') : finish('invalid')
            }
            finish('invalid')
        })()
        return () => { cancelled = true }
    }, [])

    // Inline validation (shown once a field has been edited, or on submit).
    const errors: Record<string, string> = {}
    if (form.password.length < MIN_LENGTH) errors.password = `Must be at least ${MIN_LENGTH} characters`
    if (form.confirm !== form.password) errors.confirm = 'Passwords do not match'
    const show = (k: string) => (touched[k] || touched.__all ? errors[k] : undefined)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setTouched({ __all: true })
        if (Object.keys(errors).length) return
        setSaving(true)
        setError('')
        const { error } = await supabase.auth.updateUser({ password: form.password })
        setSaving(false)
        if (error) {
            // e.g. "New password should be different from the old password."
            setError(error.message)
            return
        }
        setPhase('done')
        setTimeout(() => router.replace('/dashboard'), 1500)
    }

    if (phase === 'checking') return (
        <AuthCard title="Reset your password" subtitle="Checking your reset link…">
            <div className="flex justify-center py-6"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
        </AuthCard>
    )

    if (phase === 'invalid') return (
        <AuthCard title="This link has expired" subtitle="Reset links work once and expire after an hour.">
            {linkError && <Alert variant="danger" className="mb-6">{linkError}</Alert>}
            <Button asChild size="lg" className="w-full"><Link href="/auth/forgot-password">Send a new link</Link></Button>
            <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link href="/login" className="text-primary hover:text-primary-dark font-medium">Back to sign in</Link>
            </p>
        </AuthCard>
    )

    if (phase === 'done') return (
        <AuthCard title="Password updated" subtitle="You’re signed in — taking you to your dashboard…">
            <Alert variant="success">Your new password is set. Use it next time you sign in.</Alert>
        </AuthCard>
    )

    return (
        <AuthCard title="Choose a new password" subtitle={`At least ${MIN_LENGTH} characters.`}>
            <form onSubmit={submit} noValidate className="space-y-4">
                {error && <Alert variant="danger">{error}</Alert>}
                <InputField name="password" type="password" label="New password" autoComplete="new-password"
                    value={form.password} error={show('password')}
                    onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setTouched(t => ({ ...t, password: true })) }} />
                <InputField name="confirm" type="password" label="Confirm new password" autoComplete="new-password"
                    value={form.confirm} error={show('confirm')}
                    onChange={e => { setForm(f => ({ ...f, confirm: e.target.value })); setTouched(t => ({ ...t, confirm: true })) }} />
                <Button type="submit" size="lg" className="w-full" isLoading={saving}>
                    {saving ? 'Saving…' : 'Set new password'}
                </Button>
            </form>
        </AuthCard>
    )
}
