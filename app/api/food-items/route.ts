import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET: search food items
export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get('q') ?? ''
    const { data, error } = await supabaseAdmin
        .from('food_items')
        .select('id, name, calories_per_100g, protein_g, carbs_g, fat_g, is_cookhouse_item')
        .ilike('name', `%${q.trim()}%`)
        .order('is_cookhouse_item', { ascending: false })
        .limit(10)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// POST: create a custom food item (or return existing match by name)
export async function POST(req: NextRequest) {
    const { name, calories_per_100g, protein_g, carbs_g, fat_g, created_by } = await req.json()

    // Return existing if a food with this exact name already exists
    const { data: existing } = await supabaseAdmin
        .from('food_items')
        .select('id, name, calories_per_100g, protein_g, carbs_g, fat_g, is_cookhouse_item')
        .ilike('name', name.trim())
        .limit(1)
        .maybeSingle()

    if (existing) return NextResponse.json(existing)

    const { data, error } = await supabaseAdmin
        .from('food_items')
        .insert({
            name: name.trim(),
            calories_per_100g,
            protein_g,
            carbs_g,
            fat_g,
            is_cookhouse_item: false,
            created_by,
        })
        .select('id, name, calories_per_100g, protein_g, carbs_g, fat_g, is_cookhouse_item')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
