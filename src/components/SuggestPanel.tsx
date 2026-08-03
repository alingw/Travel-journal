import { useMemo, useState } from 'react'
import { useTrip, tripDays } from '../store/tripStore'
import {
  suggestSchedule,
  getSavedSuggestions,
  saveSuggestion,
  deleteSavedSuggestion,
  type Assignment,
  type Suggestion,
} from '../services/suggest'
import { dowLabel, dayNumLabel } from '../utils/dates'

type Draft = { reasoning: string; assignments: Assignment[] } | null

// AI schedule suggester: generate a plan, review it, then apply it to the
// schedule or save it as a reviewable "chat" for later.
export function SuggestPanel({ onClose }: { onClose: () => void }) {
  const trip = useTrip((s) => s.trip)
  const places = useTrip((s) => s.places)
  const applySchedule = useTrip((s) => s.applySchedule)

  const days = trip ? tripDays(trip) : []
  const nameOf = useMemo(() => {
    const m = new Map(places.map((p) => [p.id, p.name]))
    return (id: string) => m.get(id) ?? id
  }, [places])

  const [draft, setDraft] = useState<Draft>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState<Suggestion[]>(() =>
    trip ? getSavedSuggestions(trip.id) : [],
  )
  const [note, setNote] = useState('')

  async function generate() {
    if (!trip) return
    setErr('')
    setNote('')
    setBusy(true)
    try {
      const s = await suggestSchedule(trip, places, days)
      setDraft(s)
    } catch (e: any) {
      setErr(e?.message ?? 'could not get a suggestion')
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    if (!draft) return
    applySchedule(draft.assignments)
    onClose()
  }

  function save() {
    if (!trip || !draft) return
    const entry = saveSuggestion(trip.id, draft)
    setSaved((s) => [entry, ...s])
    setNote('Saved — you can review it below anytime.')
  }

  function removeSaved(id: string) {
    if (!trip) return
    deleteSavedSuggestion(trip.id, id)
    setSaved((s) => s.filter((x) => x.id !== id))
  }

  // Group a draft's assignments by day for a readable preview.
  const preview = useMemo(() => {
    if (!draft) return []
    return days
      .map((d) => ({
        day: d,
        items: draft.assignments
          .filter((a) => a.dayDate === d)
          .sort((a, b) => a.order - b.order),
      }))
      .filter((g) => g.items.length > 0)
  }, [draft, days])

  const scheduledCount = draft ? draft.assignments.length : 0
  const total = places.length

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>✦ Suggest a schedule</h3>
        <div className="tray-hint" style={{ marginBottom: 12 }}>
          The AI looks at your wishlist and current plan, then proposes the best day-by-day
          arrangement. Review it, then apply it or save it to look at later.
        </div>

        {err && <div className="banner">{err}</div>}
        {note && (
          <div className="banner" style={{ borderColor: 'var(--accent)' }}>
            {note}
          </div>
        )}

        {!draft && (
          <button className="btn" disabled={busy} onClick={generate}>
            {busy ? <span className="spin">↻</span> : '✦ Generate suggestion'}
          </button>
        )}

        {draft && (
          <div>
            <div className="blurb-preview" style={{ marginBottom: 10 }}>
              {draft.reasoning}
            </div>
            <div className="tray-hint">
              Schedules {scheduledCount} of {total} places. The rest stay in your wishlist.
            </div>
            <div className="suggest-preview">
              {preview.map((g) => (
                <div key={g.day} className="suggest-day">
                  <div className="suggest-day-head">
                    {dowLabel(g.day)} {dayNumLabel(g.day)}
                  </div>
                  {g.items.map((a) => (
                    <div key={a.placeId} className="suggest-item">
                      <span className="suggest-time">{a.startTime || '·'}</span>
                      <span>{nameOf(a.placeId)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="mini-btn" onClick={() => setDraft(null)}>
                ↺ new suggestion
              </button>
              <div className="spacer" />
              <button className="btn ghost" onClick={save}>
                Save for later
              </button>
              <button className="btn" onClick={apply}>
                Apply to schedule
              </button>
            </div>
          </div>
        )}

        {saved.length > 0 && (
          <>
            <div className="section-title" style={{ fontSize: '1rem', marginTop: 18 }}>
              Saved suggestions
            </div>
            {saved.map((s) => (
              <div key={s.id} className="loc-pick" style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <strong style={{ flex: 1 }}>{new Date(s.createdAt).toLocaleString()}</strong>
                  <span className="link" onClick={() => setDraft({ reasoning: s.reasoning, assignments: s.assignments })}>
                    review
                  </span>
                  <span className="link" onClick={() => removeSaved(s.id)}>
                    delete
                  </span>
                </div>
                <div className="addr">{trim(s.reasoning, 100)}</div>
              </div>
            ))}
          </>
        )}

        <div className="modal-actions">
          <div className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function trim(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}
