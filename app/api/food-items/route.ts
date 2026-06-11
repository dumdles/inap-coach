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
    const { name, calories_per_100g, protein_g, carbs_g, fat_g, is_cookhouse_item, created_by } = await req.json()

    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
    if (calories_per_100g == null || calories_per_100g < 0 || calories_per_100g > 900)
        return NextResponse.json({ error: 'calories_per_100g must be 0–900' }, { status: 400 })
    if (protein_g == null || protein_g < 0 || protein_g > 100)
        return NextResponse.json({ error: 'protein_g must be 0–100' }, { status: 400 })
    if (carbs_g == null || carbs_g < 0 || carbs_g > 100)
        return NextResponse.json({ error: 'carbs_g must be 0–100' }, { status: 400 })
    if (fat_g == null || fat_g < 0 || fat_g > 100)
        return NextResponse.json({ error: 'fat_g must be 0–100' }, { status: 400 })

    // Enforce per-user custom food item cap
    if (created_by) {
        const { count, error: countError } = await supabaseAdmin
            .from('food_items')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', created_by)
            .eq('is_cookhouse_item', false)
        if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
        if ((count ?? 0) >= 200)
            return NextResponse.json({ error: 'Custom food item limit reached (200). Delete some items to add new ones.' }, { status: 429 })
    }

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
            is_cookhouse_item: is_cookhouse_item ?? false,
            created_by,
        })
        .select('id, name, calories_per_100g, protein_g, carbs_g, fat_g, is_cookhouse_item')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
