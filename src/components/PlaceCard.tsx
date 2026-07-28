import type { Place } from '../types'
import { CATEGORY_LABELS } from '../types'
import { Sticker } from './Sticker'
import { useEditor } from '../store/editorStore'

// A scheduled entry as it appears on a journal day page / today timeline.
// All editing happens in the shared PlaceEditor modal (opened via ✎ edit).
export function PlaceCard({
  place,
  showTape,
  onReorder,
}: {
  place: Place
  showTape?: boolean
  onReorder?: (dir: -1 | 1) => void
}) {
  const openEditor = useEditor((s) => s.openEditor)

  return (
    <div className={`place-card ${showTape ? 'tape-top' : ''}`}>
      <Sticker id={place.stickerId} />
      <div className="body">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <span className="cat-tag">{CATEGORY_LABELS[place.category]}</span>
          {place.startTime && <span className="time">{place.startTime}</span>}
        </div>
        <div className="title">{place.name}</div>
        {place.address && <div className="addr">{place.address}</div>}
        {place.blurb && <div className="blurb">{trim(place.blurb)}</div>}
        {place.notes && <div className="note">✎ {place.notes}</div>}

        <div className="add-controls" style={{ marginTop: 6 }}>
          {onReorder && (
            <>
              <button className="mini-btn" onClick={() => onReorder(-1)} title="Earlier">
                ▲
              </button>
              <button className="mini-btn" onClick={() => onReorder(1)} title="Later">
                ▼
              </button>
            </>
          )}
          <button className="mini-btn" onClick={() => openEditor(place)} title="Edit">
            ✎ edit
          </button>
        </div>
      </div>
    </div>
  )
}

function trim(s: string, n = 140) {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}
