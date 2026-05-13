import { NextRequest, NextResponse } from 'next/server'

// Curated Asian/Singapore-relevant categories on Open Food Facts
const ALLOWED_CATEGORIES = new Set([
    'rice', 'noodle', 'noodles', 'tofu', 'soy', 'soya', 'miso', 'ramen',
    'congee', 'pho', 'laksa', 'curry', 'sambal', 'tempeh', 'kimchi',
    'satay', 'dim sum', 'dumpling', 'wonton', 'char siu', 'bak kut teh',
    'fish sauce', 'oyster sauce', 'hoisin', 'sesame', 'coconut milk',
    'palm sugar', 'pandan', 'beancurd', 'tau kwa', 'tau pok',
])

function isAsianRelevant(name: string): boolean {
    const lower = name.toLowerCase()
    return ALLOWED_CATEGORIES.has(lower) ||
        [...ALLOWED_CATEGORIES].some(k => lower.includes(k))
}

type OFFProduct = {
    product_name?: string
    countries_tags?: string[]
    nutriments?: {
        'energy-kcal_100g'?: number
        proteins_100g?: number
        carbohydrates_100g?: number
        fat_100g?: number
    }
}

// GET /api/food-items/off-search?q=...
export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get('q')?.trim()
    if (!q) return NextResponse.json([])

    // Try Singapore-tagged results first; world.openfoodfacts.org as fallback
    const sgUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&fields=product_name,nutriments,countries_tags&page_size=20&search_simple=1&action=process&tagtype_0=countries&tag_contains_0=contains&tag_0=singapore`
    const worldUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&fields=product_name,nutriments,countries_tags&page_size=20&search_simple=1&action=process`

    try {
        let products: OFFProduct[] = []

        const sgRes = await fetch(sgUrl, {
            headers: { 'User-Agent': 'INAP-Coach/1.0 (educational nutrition tracker)' },
            signal: AbortSignal.timeout(4000),
        })

        if (sgRes.ok) {
            const data = await sgRes.json()
            products = data.products ?? []
        }

        // If not enough SG results, supplement with broader Asian-filtered search
        if (products.length < 3) {
            const worldRes = await fetch(worldUrl, {
                headers: { 'User-Agent': 'INAP-Coach/1.0 (educational nutrition tracker)' },
                signal: AbortSignal.timeout(4000),
            })
            if (worldRes.ok) {
                const data = await worldRes.json()
                const worldProducts: OFFProduct[] = data.products ?? []
                // Keep items from Asian-relevant countries or matching Asian keywords
                const asian = worldProducts.filter(p => {
                    const countries = p.countries_tags ?? []
                    const isAsianCountry = countries.some(c =>
                        ['singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam',
                            'china', 'japan', 'south-korea', 'hong-kong', 'taiwan', 'philippines', 'india']
                            .some(ac => c.includes(ac))
                    )
                    return isAsianCountry || isAsianRelevant(p.product_name ?? '')
                })
                products = [...products, ...asian]
            }
        }

        // Normalise and deduplicate
        const seen = new Set<string>()
        const results = products
            .filter(p => p.product_name?.trim())
            .map(p => {
                const n = p.nutriments ?? {}
                return {
                    name: p.product_name!.trim(),
                    calories_per_100g: Math.round(n['energy-kcal_100g'] ?? 0),
                    protein_g: parseFloat((n.proteins_100g ?? 0).toFixed(1)),
                    carbs_g: parseFloat((n.carbohydrates_100g ?? 0).toFixed(1)),
                    fat_g: parseFloat((n.fat_100g ?? 0).toFixed(1)),
                }
            })
            .filter(item => {
                if (seen.has(item.name.toLowerCase())) return false
                seen.add(item.name.toLowerCase())
                return item.calories_per_100g > 0
            })
            .slice(0, 6)

        return NextResponse.json(results)
    } catch {
        return NextResponse.json([])
    }
}
