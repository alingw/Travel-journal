import { useState } from 'react'
import { searchPlaces, type GeoResult } from '../services/geocode'
import { fetchPlaceInfo } from '../services/placeInfo'
import { useTrip, tripDays } from '../store/tripStore'
import { CATEGORY_LABELS, type Category } from '../types'
import { Sticker } from './Sticker'
import { resolveStickerId } from '../services/stickers'
import { getAutoInfo } from '../utils/settings'
import { dowLabel, dayNumLabel } from '../utils/dates'

// Search the internet for a place, enrich it, and add it to the wishlist or a day.
export function SearchAddPanel() {
  const trip = useTrip((s) => s.trip)
  const addPlace = useTrip((s) => s.addPlace)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<GeoResult[]>([])
  const [added, setAdded] = useState<Record<string, boolean>>({})

  const days = tripDays(trip)

  async function run() {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    try {
      const r = await searchPlaces(q.trim(), trip?.baseCity)
      if (r.length === 0) setError('No places found — try a more specific name.')
      setResults(r)
    } catch (e: any) {
      setError(e?.message ?? 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="search-panel">
      <div className="section-title">Add a place</div>
      <div className="tray-hint">
        Search real places — we’ll pull the location + a quick blurb from the web and match a sticker.
      </div>
      <div className="search-row">
        <input
          value={q}
          placeholder="e.g. Arthur Ashe Stadium, or “ramen near Flushing”"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? <span className="spin">↻</span> : 'Search'}
        </button>
      </div>

      {error && <div className="banner">{error}</div>}

      <div className="results">
        {results.map((r, i) => (
          <ResultRow
            key={i}
            result={r}
            days={days}
            added={!!added[keyOf(r)]}
            onAdd={async (category, day) => {
              const info: { blurb?: string; photoUrl?: string } = getAutoInfo()
                ? await fetchPlaceInfo(r.name)
                : {}
              await addPlace({
                name: r.name,
                category,
                lat: r.lat,
                lng: r.lng,
                address: r.address,
                blurb: info.blurb,
                photoUrl: info.photoUrl,
                status: day ? 'scheduled' : 'wishlist',
                dayDate: day,
              })
              setAdded((s) => ({ ...s, [keyOf(r)]: true }))
            }}
          />
        ))}
      </div>
    </div>
  )
}

function keyOf(r: GeoResult) {
  return `${r.name}-${r.lat}-${r.lng}`
}

function ResultRow({
  result,
  days,
  added,
  onAdd,
}: {
  result: GeoResult
  days: string[]
  added: boolean
  onAdd: (category: Category, day?: string) => Promise<void>
}) {
  const [category, setCategory] = useState<Category>(result.category)
  const [day, setDay] = useState<string>('') // '' = wishlist
  const [busy, setBusy] = useState(false)
  const stickerId = resolveStickerId(result.name, category)

  return (
    <div className="place-card">
      <Sticker id={stickerId} />
      <div className="body">
        <div className="title">{result.name}</div>
        {result.address && <div className="addr">{result.address}</div>}
        <div className="add-controls">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            <option value="">📌 Wishlist</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {dowLabel(d)} {dayNumLabel(d)}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={added || busy}
            onClick={async () => {
              setBusy(true)
              await onAdd(category, day || undefined)
              setBusy(false)
            }}
          >
            {added ? '✓ Added' : busy ? <span className="spin">↻</span> : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
