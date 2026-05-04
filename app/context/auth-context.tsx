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
            setSession(session)
            setUser(session?.user ?? null)

            // Handle token refresh
            if (event === 'TOKEN_REFRESHED') {
                console.log('Token refreshed')
            }
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
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            })

            if (error) throw error

            if (!data.user) {
                throw new Error('User creation failed')
            }

            // Create user profile
            const { error: profileError } = await supabase
                .from('users')
                .insert([
                    {
                        id: data.user.id,
                        email,
                        username: email.split('@')[0],
                        ...userData,
                    },
                ])

            if (profileError) {
                // Clean up auth user if profile fails
                await supabase.auth.admin.deleteUser(data.user.id)
                throw profileError
            }

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