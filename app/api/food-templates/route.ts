import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/food-templates
// Returns system food items grouped by category
export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('food_items')
        .select('id, name, calories_per_100g, protein_g, carbs_g, fat_g, is_cookhouse_item, category')
        .is('created_by', null)
        .not('category', 'is', null)
        .order('category')
        .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [], {
        headers: { 'Cache-Control': 'public, max-age=3600' },
    })
}
