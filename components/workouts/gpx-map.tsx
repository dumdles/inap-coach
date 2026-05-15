"use client"

import * as React from "react"
import dynamic from "next/dynamic"

// Leaflet must be loaded client-side only (no SSR)
const LeafletMap = dynamic(() => import("./leaflet-map"), { ssr: false, loading: () => (
    <div className="w-full h-[220px] rounded-2xl bg-muted animate-pulse" />
)})

export function GpxMap({ gpx }: { gpx: string }) {
    // Parse GPX trkpt lat/lon pairs
    const points = React.useMemo(() => {
        const matches = [...gpx.matchAll(/<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g)]
        return matches.map(m => [parseFloat(m[1]), parseFloat(m[2])] as [number, number])
    }, [gpx])

    if (points.length === 0) return null
    return <LeafletMap points={points} />
}
