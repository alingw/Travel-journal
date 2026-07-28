// "Real route" geometry via the public OSRM demo server (free, no key, CORS-open).
// Given ordered stops, returns road-following coordinates. Falls back to the
// straight-line points if routing is unavailable. Results are cached in-memory.

type LatLng = [number, number]

const cache = new Map<string, LatLng[]>()

function keyOf(points: LatLng[]): string {
  return points.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join('|')
}

export async function fetchRoute(points: LatLng[]): Promise<LatLng[]> {
  if (points.length < 2) return points
  const key = keyOf(points)
  const cached = cache.get(key)
  if (cached) return cached

  // OSRM wants lng,lat order.
  const coords = points.map((p) => `${p[1]},${p[0]}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('no route')
    const line: LatLng[] = data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as LatLng,
    )
    cache.set(key, line)
    return line
  } catch {
    // Graceful fallback: straight segments between stops.
    cache.set(key, points)
    return points
  }
}
