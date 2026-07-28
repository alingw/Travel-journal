// Short place blurb + thumbnail from the Wikipedia REST summary API (free, no key).
// Best-effort: if there's no matching article we just return nothing and the app
// carries on with the name alone.

export interface PlaceInfo {
  blurb?: string
  photoUrl?: string
}

export async function fetchPlaceInfo(name: string): Promise<PlaceInfo> {
  try {
    const url =
      'https://en.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(name.replace(/\s+/g, '_'))
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return {}
    const data = (await res.json()) as any
    if (data.type === 'disambiguation') return {}
    return {
      blurb: typeof data.extract === 'string' ? data.extract : undefined,
      photoUrl: data.thumbnail?.source as string | undefined,
    }
  } catch {
    return {}
  }
}
