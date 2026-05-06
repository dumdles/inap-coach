import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
    const { email, password, userData } = await req.json()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userData,
    })

    if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert([{ id: userId, email, ...userData }])

    if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ userId }, { status: 201 })
}
