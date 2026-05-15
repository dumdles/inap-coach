"use client"

import * as React from "react"
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"

function FitBounds({ points }: { points: [number, number][] }) {
    const map = useMap()
    React.useEffect(() => {
        if (points.length > 0) map.fitBounds(points)
    }, [map, points])
    return null
}

export default function LeafletMap({ points }: { points: [number, number][] }) {
    const center = points[Math.floor(points.length / 2)] ?? [1.3521, 103.8198]
    return (
        <MapContainer
            center={center}
            zoom={14}
            className="w-full rounded-2xl overflow-hidden"
            style={{ height: 220 }}
            zoomControl={false}
            attributionControl={false}
        >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline positions={points} color="var(--primary)" weight={3} opacity={0.85} />
            <FitBounds points={points} />
        </MapContainer>
    )
}
