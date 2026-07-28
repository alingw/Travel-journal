// Place search via OpenStreetMap Nominatim (free, no key).
// Personal-use friendly; we keep volume low and send a descriptive User-Agent-ish
// Referer. Results carry a best-guess category so the sticker matcher has something.

import type { Category } from '../types'

export interface GeoResult {
  name: string
  lat: number
  lng: number
  address?: string
  category: Category
}

// Map Nominatim class/type hints to our categories.
function guessCategory(item: any): Category {
  const cls = (item.class ?? '').toLowerCase()
  const type = (item.type ?? '').toLowerCase()
  const s = `${cls} ${type}`
  if (/aeroway|airport/.test(s)) return 'transport'
  if (/hotel|hostel|motel|guest_house|tourism.*hotel/.test(s)) return 'lodging'
  if (/restaurant|cafe|fast_food|bar|pub|food|bakery|ice_cream/.test(s)) return 'food'
  if (/stadium|sports|pitch|theatre|cinema|arts_centre|events/.test(s)) return 'event'
  if (/station|railway|subway|bus|transport|platform/.test(s)) return 'transport'
  if (/museum|attraction|viewpoint|monument|memorial|artwork|gallery|zoo|park|garden|tourism/.test(s))
    return 'sight'
  return 'other'
}

function shortName(item: any): string {
  // Nominatim's display_name is long; the first comma-segment is usually the place.
  const dn: string = item.display_name ?? ''
  return item.namedetails?.name || dn.split(',')[0] || dn
}

export async function searchPlaces(query: string, near?: string): Promise<GeoResult[]> {
  const q = near ? `${query}, ${near}` : query
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&limit=6&q=' +
    encodeURIComponent(q)
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const items = (await res.json()) as any[]
  return items.map((it) => ({
    name: shortName(it),
    lat: parseFloat(it.lat),
    lng: parseFloat(it.lon),
    address: (it.display_name as string)?.split(',').slice(1, 4).join(',').trim(),
    category: guessCategory(it),
  }))
}
