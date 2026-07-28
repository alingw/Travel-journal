import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L, { type Map as LeafletMap } from 'leaflet'
import { useTrip, tripDays } from '../store/tripStore'
import type { Place } from '../types'
import { stickerSvg } from '../services/stickers'
import { RouteOverlay, type RouteSegment } from '../components/RouteOverlay'
import { fetchRoute } from '../services/routing'
import { dayNumLabel, dowLabel } from '../utils/dates'
import { getStadiaKey, setStadiaKey } from '../utils/settings'

type RouteMode = 'lines' | 'real'

// Distinct, watercolor-ish colors assigned to days in order.
const DAY_COLORS = [
  '#e07a5f', '#6a9fb5', '#6f9a6f', '#e2b04a',
  '#9a6f9a', '#c9772f', '#4f8a8b', '#b5546a',
]
const WISH_COLOR = '#8a7a63'

function hasCoords(p: Place): p is Place & { lat: number; lng: number } {
  return typeof p.lat === 'number' && typeof p.lng === 'number'
}

// Sticker marker with a day-colored ring.
function stickerIcon(place: Place, color: string): L.DivIcon {
  return L.divIcon({
    className: 'sticker-div-icon',
    html: `<div style="position:relative">
      <div class="map-marker" style="border-color:${color}">${stickerSvg(place.stickerId)}</div>
      <div class="map-label" style="position:absolute;top:44px;left:50%;transform:translateX(-50%)">${escapeHtml(
        place.name,
      )}</div>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

export function MapView() {
  const trip = useTrip((s) => s.trip)
  const places = useTrip((s) => s.places)
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [dayFilter, setDayFilter] = useState<string>('all')
  const [routeMode, setRouteMode] = useState<RouteMode>('lines')
  const [key, setKey] = useState<string>(getStadiaKey())

  // Memoized so derived memos/effects below don't re-run every render (a fresh
  // array each render would loop the OSRM effect infinitely).
  const days = useMemo(() => tripDays(trip), [trip?.startDate, trip?.endDate])
  const dayColor = (day?: string) => {
    const i = day ? days.indexOf(day) : -1
    return DAY_COLORS[(i < 0 ? 0 : i) % DAY_COLORS.length]
  }

  // Markers to render (only places that actually have coordinates).
  const markers = useMemo(() => {
    const withCoords = places.filter(hasCoords)
    const source =
      dayFilter === 'all'
        ? withCoords
        : withCoords.filter((p) => p.status === 'scheduled' && p.dayDate === dayFilter)
    return source.map((p) => ({
      place: p,
      color: p.status === 'scheduled' ? dayColor(p.dayDate) : WISH_COLOR,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, dayFilter, days])

  // Ordered stops grouped by day (for both route modes).
  const dayGroups = useMemo(() => {
    const scope = dayFilter === 'all' ? days : [dayFilter]
    return scope
      .map((day) => ({
        day,
        color: dayColor(day),
        points: places
          .filter((p) => p.status === 'scheduled' && p.dayDate === day)
          .filter(hasCoords)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((p) => [p.lat, p.lng] as [number, number]),
      }))
      .filter((g) => g.points.length >= 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, dayFilter, days])

  const lineSegments: RouteSegment[] = useMemo(
    () =>
      dayGroups
        .filter((g) => g.points.length >= 2)
        .map((g) => ({ key: 'L-' + g.day, color: g.color, points: g.points })),
    [dayGroups],
  )

  // "Real route" segments — fetched from OSRM when that mode is on.
  const [realSegments, setRealSegments] = useState<RouteSegment[]>([])
  const [routing, setRouting] = useState(false)
  useEffect(() => {
    if (routeMode !== 'real') {
      setRealSegments([])
      return
    }
    let cancelled = false
    setRouting(true)
    Promise.all(
      dayGroups
        .filter((g) => g.points.length >= 2)
        .map(async (g) => ({
          key: 'R-' + g.day,
          color: g.color,
          points: await fetchRoute(g.points),
        })),
    ).then((segs) => {
      if (!cancelled) {
        setRealSegments(segs)
        setRouting(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [routeMode, dayGroups])

  const segments = routeMode === 'real' ? realSegments : lineSegments

  // Fit the map to whatever's visible whenever it changes.
  useEffect(() => {
    if (!map || markers.length === 0) return
    const bounds = L.latLngBounds(markers.map((m) => [m.place.lat!, m.place.lng!]))
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
  }, [map, markers])

  const hasKey = key.trim().length > 0
  const tileUrl = hasKey
    ? `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${key}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  const attribution = hasKey
    ? '&copy; Stadia Maps, Stamen Design, OpenMapTiles &amp; OpenStreetMap'
    : '&copy; OpenStreetMap contributors'

  const legendDays = days.filter((d) =>
    places.some((p) => p.status === 'scheduled' && p.dayDate === d && hasCoords(p)),
  )

  return (
    <div className={`map-wrap ${hasKey ? '' : 'map-warm'}`}>
      <div className="day-filter">
        <button
          className={`day-pill ${dayFilter === 'all' ? 'active' : ''}`}
          onClick={() => setDayFilter('all')}
        >
          Whole trip
        </button>
        {days.map((d) => (
          <button
            key={d}
            className={`day-pill ${dayFilter === d ? 'active' : ''}`}
            onClick={() => setDayFilter(d)}
          >
            <span className="day-dot" style={{ background: dayColor(d) }} />
            {dowLabel(d)} {dayNumLabel(d)}
          </button>
        ))}
      </div>

      <div className="map-controls">
        <div className="mode-toggle">
          <button
            className={routeMode === 'lines' ? 'active' : ''}
            onClick={() => setRouteMode('lines')}
          >
            〰 Lines
          </button>
          <button
            className={routeMode === 'real' ? 'active' : ''}
            onClick={() => setRouteMode('real')}
          >
            🛣 Real route
          </button>
        </div>
        {dayFilter === 'all' && legendDays.length > 0 && (
          <div className="legend">
            {legendDays.map((d) => (
              <div key={d} className="legend-row">
                <span className="day-dot" style={{ background: dayColor(d) }} />
                {dowLabel(d)} {dayNumLabel(d)}
              </div>
            ))}
          </div>
        )}
      </div>

      <MapContainer
        ref={setMap as any}
        center={[40.75, -73.95]}
        zoom={11}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={tileUrl} attribution={attribution} />
        {markers.map((m) => (
          <Marker
            key={m.place.id}
            position={[m.place.lat!, m.place.lng!]}
            icon={stickerIcon(m.place, m.color)}
          />
        ))}
      </MapContainer>

      <RouteOverlay map={map} segments={segments} animKey={`${dayFilter}-${routeMode}`} />

      <div className="route-note">
        {routing
          ? 'tracing the real roads…'
          : routeMode === 'real'
          ? dayFilter === 'all'
            ? '~ real routes, colored by day ~'
            : `${dowLabel(dayFilter)}'s real route`
          : dayFilter === 'all'
          ? '~ the whole journey ~'
          : `${dowLabel(dayFilter)}'s path`}
      </div>

      {!hasKey && (
        <WatercolorPrompt
          onSave={(k) => {
            setStadiaKey(k)
            setKey(k)
          }}
        />
      )}
    </div>
  )
}

// Gentle nudge to add a free Stadia key for the true watercolor tiles.
function WatercolorPrompt({ onSave }: { onSave: (k: string) => void }) {
  const [val, setVal] = useState('')
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <button
        className="day-pill"
        style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 500 }}
        onClick={() => setOpen(true)}
      >
        🎨 Watercolor tiles…
      </button>
    )
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        right: 10,
        zIndex: 500,
        background: '#fffdf6',
        border: '1.5px solid var(--paper-line)',
        borderRadius: 10,
        padding: 10,
        maxWidth: 260,
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
        Paste a free{' '}
        <a className="link" href="https://client.stadiamaps.com/signup/" target="_blank" rel="noreferrer">
          Stadia Maps API key
        </a>{' '}
        for real Stamen watercolor tiles.
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="api key"
          style={{
            flex: 1,
            fontFamily: 'var(--hand)',
            border: '1.5px solid var(--paper-line)',
            borderRadius: 8,
            padding: '4px 6px',
            background: '#fff',
            color: 'var(--ink)',
          }}
        />
        <button className="btn" onClick={() => val.trim() && onSave(val.trim())}>
          Save
        </button>
      </div>
    </div>
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}
