import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Get current session
export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) console.error('Session error:', error)
        return session
}

// TODO: Get current user
export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) console.error('User error:', error)
    return user
}

// TODO: Sign up new user
export async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    })
    if (error) console.error('Sign up error:', error)
    return data
}

// TODO: Sign in existing user with email + password (can change)
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })
    if (error) console.error('Sign in error:', error)
    return data
}

// TODO : Connect Supabase auth with users table in database (can change)
