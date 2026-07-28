import { useEffect, useState } from 'react'
import { useTrip, tripDays } from '../store/tripStore'
import { useEditor } from '../store/editorStore'
import { CATEGORY_LABELS, type Category, type Place } from '../types'
import { searchPlaces, type GeoResult } from '../services/geocode'
import { fetchPlaceInfo } from '../services/placeInfo'
import { resolveStickerId } from '../services/stickers'
import { Sticker } from './Sticker'
import { dowLabel, dayNumLabel } from '../utils/dates'

// Thin wrapper: only mounts the form when open, and keys it to the place being
// edited so the form's initial state is always seeded from THAT place (fixes the
// "edit opened a blank/new entry" bug).
export function PlaceEditor() {
  const open = useEditor((s) => s.open)
  const place = useEditor((s) => s.place)
  const defaultDay = useEditor((s) => s.defaultDay)
  const close = useEditor((s) => s.closeEditor)
  if (!open) return null
  return (
    <EditorForm
      key={place?.id ?? 'new'}
      place={place}
      defaultDay={defaultDay}
      onClose={close}
    />
  )
}

function EditorForm({
  place: editing,
  defaultDay,
  onClose,
}: {
  place: Place | null
  defaultDay?: string
  onClose: () => void
}) {
  const trip = useTrip((s) => s.trip)
  const addPlace = useTrip((s) => s.addPlace)
  const updatePlace = useTrip((s) => s.updatePlace)
  const assignToDay = useTrip((s) => s.assignToDay)
  const moveToWishlist = useTrip((s) => s.moveToWishlist)
  const deletePlace = useTrip((s) => s.deletePlace)
  const days = tripDays(trip)

  // Seeded from the place being edited (or blanks + defaultDay for a new one).
  const [name, setName] = useState(editing?.name ?? '')
  const [category, setCategory] = useState<Category>(editing?.category ?? 'other')
  const [day, setDay] = useState<string>(
    editing ? (editing.status === 'scheduled' ? editing.dayDate ?? '' : '') : defaultDay ?? '',
  )
  const [time, setTime] = useState(editing?.startTime ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [loc, setLoc] = useState<{
    lat?: number
    lng?: number
    address?: string
    photoUrl?: string
    blurb?: string
  }>({
    lat: editing?.lat,
    lng: editing?.lng,
    address: editing?.address,
    photoUrl: editing?.photoUrl,
    blurb: editing?.blurb,
  })

  // --- search-engine style place lookup ---
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 3) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        setResults(await searchPlaces(query, trip?.baseCity))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 450)
    return () => clearTimeout(t)
  }, [q, trip?.baseCity])

  async function pick(r: GeoResult) {
    setName(r.name)
    setCategory((c) => (c === 'other' ? r.category : c))
    setLoc({ lat: r.lat, lng: r.lng, address: r.address })
    setQ('')
    setResults([])
    // Enrich with a blurb/photo in the background.
    const info = await fetchPlaceInfo(r.name)
    setLoc((prev) => ({ ...prev, blurb: info.blurb, photoUrl: info.photoUrl }))
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const targetDay = day || undefined
    if (editing) {
      await updatePlace(editing.id, {
        name: name.trim(),
        category,
        startTime: time || undefined,
        notes: notes || undefined,
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address,
        photoUrl: loc.photoUrl,
        blurb: loc.blurb,
        stickerId: resolveStickerId(name.trim(), category),
      })
      const wasDay = editing.status === 'scheduled' ? editing.dayDate : undefined
      if (targetDay !== wasDay) {
        if (targetDay) await assignToDay(editing.id, targetDay)
        else await moveToWishlist(editing.id)
      }
    } else {
      await addPlace({
        name: name.trim(),
        category,
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address,
        photoUrl: loc.photoUrl,
        blurb: loc.blurb,
        notes: notes || undefined,
        startTime: time || undefined,
        status: targetDay ? 'scheduled' : 'wishlist',
        dayDate: targetDay,
      })
    }
    setSaving(false)
    onClose()
  }

  const stickerId = resolveStickerId(name || '?', category)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sticker id={stickerId} size="sm" />
          {editing ? 'Edit stop' : 'Add a stop'}
        </h3>

        {/* Search-engine style lookup */}
        <div className="field">
          <label>🔍 Search a place</label>
          <input
            type="text"
            autoFocus={!editing}
            value={q}
            placeholder="type a name, e.g. Arthur Ashe Stadium…"
            onChange={(e) => setQ(e.target.value)}
          />
          {(searching || results.length > 0) && (
            <div className="search-results">
              {searching && results.length === 0 && (
                <div className="loc-pick" style={{ cursor: 'default' }}>
                  <span className="spin">↻</span> searching…
                </div>
              )}
              {results.map((r, i) => (
                <div key={i} className="loc-pick" onClick={() => pick(r)}>
                  <strong>{r.name}</strong>
                  {r.address ? <div className="addr">{r.address}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label>Name</label>
          <input
            type="text"
            value={name}
            placeholder="or type a custom entry (e.g. Lunch break)"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Type</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Day</label>
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">📌 Wishlist</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {dowLabel(d)} {dayNumLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '0 0 110px' }}>
            <label>Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Note</label>
          <textarea
            value={notes}
            placeholder="handwritten note…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {loc.lat != null && (
          <div className="loc-current">
            📍 {loc.address ?? `${loc.lat.toFixed(3)}, ${loc.lng?.toFixed(3)}`}{' '}
            <span className="link" onClick={() => setLoc({})}>
              (clear location)
            </span>
          </div>
        )}

        <div className="modal-actions">
          {editing && (
            <button
              className="mini-btn"
              onClick={() => {
                deletePlace(editing.id)
                onClose()
              }}
            >
              ✕ delete
            </button>
          )}
          <div className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save} disabled={!name.trim() || saving}>
            {saving ? <span className="spin">↻</span> : editing ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
