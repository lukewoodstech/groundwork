import { booleanPointInPolygon, polygon } from "@turf/turf";
import type { Street, Zone } from "./types";

export type LngLat = [number, number];

/** The street point inside a zone that is closest to `from`. */
export function zoneEntryPoint(zone: Zone, streets: Street[], from: LngLat): LngLat {
  const poly = polygon([[...zone.polygon, zone.polygon[0]]]);
  let best: LngLat | null = null;
  let bestD = Infinity;
  for (const s of streets) {
    for (const p of s.path) {
      const d = (p[0] - from[0]) ** 2 + ((p[1] - from[1]) * 1.3) ** 2;
      if (d < bestD && booleanPointInPolygon(p, poly)) {
        bestD = d;
        best = p;
      }
    }
  }
  return best ?? zone.polygon[0];
}

/** Walking route from Mapbox Directions, or null if it cannot be fetched. */
export async function fetchWalkingRoute(from: LngLat, to: LngLat, token: string): Promise<LngLat[] | null> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&overview=full&access_token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { geometry: { coordinates: LngLat[] } }[] };
    return data.routes?.[0]?.geometry.coordinates ?? null;
  } catch {
    return null;
  }
}
