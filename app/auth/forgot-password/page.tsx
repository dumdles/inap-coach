'use client'

// ── Forgot password ───────────────────────────────────────────────────────────
// Step 1 of resetting a password: Supabase emails a one-time link that opens
// /auth/reset-password (step 2). The redirect URL must be allowed in Supabase →
// Authentication → URL Configuration → Redirect URLs (see docs/ROLES_AND_ENVIRONMENTS.md).
//
// We always show the same "check your email" message, whether or not an
// account exists for that address, so the form can't be used to discover
// which emails are registered.

import React, { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input-field'
import { Alert } from '@/components/ui/alert'
import { AuthCard } from '@/components/auth/auth-card'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [touched, setTouched] = useState(false)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')

    const emailError = !email ? 'Email is required' : !EMAIL.test(email) ? 'Invalid email address' : ''

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setTouched(true)
        if (emailError) return
        setSending(true)
        setError('')
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/auth/reset-password`,
        })
        setSending(false)
        // Rate limits are worth telling the user about; anything else gets the
        // same neutral confirmation (don't reveal whether the email exists).
        if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
            setError('Too many reset emails requested — please wait a few minutes and try again.')
            return
        }
        setSent(true)
    }

    return (
        <AuthCard title="Reset your password" subtitle="Enter the email you signed up with and we’ll send you a link to set a new password.">
            {sent ? (
                <>
                    <Alert variant="success" className="mb-6">
                        If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. Check your inbox (and spam) — the link expires in an hour.
                    </Alert>
                    <Button variant="outline" className="w-full" onClick={() => { setSent(false); setTouched(false) }}>
                        Use a different email
                    </Button>
                </>
            ) : (
                <form onSubmit={submit} noValidate className="space-y-4">
                    {error && <Alert variant="danger">{error}</Alert>}
                    <InputField name="email" type="email" label="Email" placeholder="you@example.com" autoComplete="email"
                        value={email} onChange={e => { setEmail(e.target.value); setTouched(true) }}
                        error={touched ? emailError : undefined} />
                    <Button type="submit" size="lg" className="w-full" isLoading={sending}>
                        {sending ? 'Sending…' : 'Send reset link'}
                    </Button>
                </form>
            )}
            <p className="mt-6 text-center text-sm text-muted-foreground">
                Remembered it? <Link href="/login" className="text-primary hover:text-primary-dark font-medium">Back to sign in</Link>
            </p>
        </AuthCard>
    )
}
