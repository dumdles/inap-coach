'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
    user: User | null
    session: Session | null
    isLoading: boolean
    error: string | null
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, userData: any) => Promise<void>
    signOut: () => Promise<void>
    clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Initialize auth state on mount
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Check if user has active session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) throw sessionError

                setSession(session)
                setUser(session?.user ?? null)
            } catch (err) {
                console.error('Auth initialization error:', err)
                setError(err instanceof Error ? err.message : 'Auth error')
            } finally {
                setIsLoading(false)
            }
        }

        initializeAuth()

        // Listen for auth changes (login, logout, token refresh)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            // On token refresh, only update session — avoid changing user object
            // reference which would re-trigger every useEffect([user]) on tab focus.
            if (event === 'TOKEN_REFRESHED') {
                setSession(session)
                return
            }
            setSession(session)
            setUser(session?.user ?? null)
        })

        return () => {
            subscription?.unsubscribe()
        }
    }, [])

    const signIn = async (email: string, password: string) => {
        setError(null)
        setIsLoading(true)
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) throw error

            setUser(data.user)
            setSession(data.session)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Sign in failed'
            setError(message)
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    const signUp = async (email: string, password: string, userData: any) => {
        setError(null)
        setIsLoading(true)
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, userData }),
            })

            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? 'Sign up failed')

            // Establish client session after server-side creation
            const { data, error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) throw error

            setUser(data.user)
            setSession(data.session)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Sign up failed'
            setError(message)
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    const handleSignOut = async () => {
        setError(null)
        setIsLoading(true)
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error

            setUser(null)
            setSession(null)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Sign out failed'
            setError(message)
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    const clearError = () => setError(null)

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                isLoading,
                error,
                signIn,
                signUp,
                signOut: handleSignOut,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}