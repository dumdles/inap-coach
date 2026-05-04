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

// TODO: Sign in existing user with email + password (can change)