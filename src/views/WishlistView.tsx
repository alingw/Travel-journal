import { useTrip, tripDays } from '../store/tripStore'
import { SearchAddPanel } from '../components/SearchAddPanel'
import { Sticker } from '../components/Sticker'
import { useEditor } from '../store/editorStore'
import { CATEGORY_LABELS } from '../types'
import { dowLabel, dayNumLabel } from '../utils/dates'

// Manage "maybe" places and add new ones from the web.
export function WishlistView() {
  const trip = useTrip((s) => s.trip)
  const places = useTrip((s) => s.places)
  const assignToDay = useTrip((s) => s.assignToDay)
  const openEditor = useEditor((s) => s.openEditor)
  const days = tripDays(trip)
  const wishlist = places.filter((p) => p.status === 'wishlist')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <SearchAddPanel />

      <div>
        <div className="section-title">📌 Wishlist ({wishlist.length})</div>
        <div className="tray-hint" style={{ marginBottom: 10 }}>
          Places you might visit. Pick a day to schedule, or drag them from the Journal tab.
        </div>
        <div className="wish-grid">
          {wishlist.length === 0 && (
            <div className="day-empty">Nothing pinned — search above to add ideas.</div>
          )}
          {wishlist.map((p) => (
            <div key={p.id} className="place-card" style={{ flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <Sticker id={p.stickerId} />
                <div className="body">
                  <span className="cat-tag">{CATEGORY_LABELS[p.category]}</span>
                  <div className="title">{p.name}</div>
                  {p.address && <div className="addr">{p.address}</div>}
                </div>
              </div>
              {p.photoUrl && <img className="thumb" src={p.photoUrl} alt="" />}
              {p.blurb && <div className="blurb">{trim(p.blurb)}</div>}
              <div className="add-controls" style={{ marginTop: 8 }}>
                <select
                  defaultValue=""
                  onChange={(e) => e.target.value && assignToDay(p.id, e.target.value)}
                >
                  <option value="">Schedule to…</option>
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {dowLabel(d)} {dayNumLabel(d)}
                    </option>
                  ))}
                </select>
                <button className="mini-btn" onClick={() => openEditor(p)} title="Edit">
                  ✎ edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function trim(s: string, n = 160) {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}
