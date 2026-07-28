import { useState } from 'react'
import { useCloud } from '../store/cloudStore'
import { useTrip } from '../store/tripStore'
import {
  getCloudApi,
  setCloudApi,
  getOwnerKey,
  setOwnerKey,
  listTrips,
  setTripCode,
} from '../services/cloud'

// Modal for cloud sync: connect, open a shared trip with a code, or (as owner)
// publish / manage trips.
export function CloudPanel({ onClose }: { onClose: () => void }) {
  const session = useCloud((s) => s.session)
  const status = useCloud((s) => s.status)
  const message = useCloud((s) => s.message)
  const open = useCloud((s) => s.open)
  const publish = useCloud((s) => s.publish)
  const leave = useCloud((s) => s.leave)
  const trip = useTrip((s) => s.trip)

  const [api, setApi] = useState(getCloudApi())
  const [ownerKey, setOwner] = useState(getOwnerKey())

  // Open form
  const [openId, setOpenId] = useState('')
  const [openCode, setOpenCode] = useState('')
  // Publish form
  const [slug, setSlug] = useState(slugify(trip?.name ?? ''))
  const [pubCode, setPubCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [trips, setTrips] = useState<string[] | null>(null)

  function saveConn() {
    setCloudApi(api)
    setOwnerKey(ownerKey)
  }

  async function doOpen() {
    setErr('')
    setBusy(true)
    try {
      setCloudApi(api)
      await open(openId.trim(), openCode.trim())
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? 'could not open')
    } finally {
      setBusy(false)
    }
  }

  async function doPublish() {
    setErr('')
    if (!/^\d{4}$/.test(pubCode)) return setErr('Code must be 4 digits')
    if (!slug.trim()) return setErr('Pick a trip id')
    setBusy(true)
    try {
      saveConn()
      await publish(ownerKey.trim(), slug.trim(), pubCode.trim())
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? 'could not publish')
    } finally {
      setBusy(false)
    }
  }

  async function doList() {
    setErr('')
    setBusy(true)
    try {
      saveConn()
      const r = await listTrips(ownerKey.trim())
      setTrips(r.trips)
    } catch (e: any) {
      setErr(e?.message ?? 'could not list')
    } finally {
      setBusy(false)
    }
  }

  async function rotate(id: string) {
    const code = prompt(`New 4-digit code for "${id}"`)
    if (!code || !/^\d{4}$/.test(code)) return
    setBusy(true)
    try {
      await setTripCode(ownerKey.trim(), id, code)
      alert(`Code updated for ${id}`)
    } catch (e: any) {
      setErr(e?.message ?? 'could not update code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>☁ Cloud sync</h3>

        {session ? (
          <div className="banner" style={{ background: '#eaf5ea', borderColor: 'var(--green)' }}>
            Editing <strong>{session.tripId}</strong> from GitHub — {statusText(status, message)}.
            <div style={{ marginTop: 6 }}>
              <button className="btn ghost" onClick={leave}>
                Leave cloud (back to local trip)
              </button>
            </div>
          </div>
        ) : (
          <div className="tray-hint" style={{ marginBottom: 10 }}>
            Sync a trip to GitHub so others can edit it with a 4-digit code.
          </div>
        )}

        <div className="field">
          <label>Sync service URL</label>
          <input
            type="text"
            value={api}
            placeholder="https://your-app.vercel.app"
            onChange={(e) => setApi(e.target.value)}
            onBlur={() => setCloudApi(api)}
          />
        </div>

        {err && <div className="banner">{err}</div>}

        {!session && (
          <>
            <div className="section-title" style={{ fontSize: '1.15rem', marginTop: 8 }}>
              Open a shared trip
            </div>
            <div className="field-row">
              <div className="field">
                <label>Trip id</label>
                <input
                  type="text"
                  value={openId}
                  placeholder="e.g. us-open-2026"
                  onChange={(e) => setOpenId(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: '0 0 120px' }}>
                <label>4-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={openCode}
                  placeholder="1234"
                  onChange={(e) => setOpenCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
            <button className="btn" disabled={busy} onClick={doOpen}>
              {busy ? <span className="spin">↻</span> : 'Open & edit'}
            </button>

            <div className="section-title" style={{ fontSize: '1.15rem', marginTop: 18 }}>
              Owner tools
            </div>
            <div className="field">
              <label>Owner key</label>
              <input
                type="password"
                value={ownerKey}
                placeholder="your secret owner key"
                onChange={(e) => setOwner(e.target.value)}
                onBlur={() => setOwnerKey(ownerKey)}
              />
            </div>
            <div className="tray-hint">
              Publish the trip you’re currently viewing and assign it a 4-digit code.
            </div>
            <div className="field-row">
              <div className="field">
                <label>New trip id</label>
                <input type="text" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </div>
              <div className="field" style={{ flex: '0 0 120px' }}>
                <label>Assign code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pubCode}
                  placeholder="1234"
                  onChange={(e) => setPubCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="mini-btn" disabled={busy} onClick={doList}>
                List my trips
              </button>
              <div className="spacer" />
              <button className="btn ghost" onClick={onClose}>
                Close
              </button>
              <button className="btn" disabled={busy} onClick={doPublish}>
                {busy ? <span className="spin">↻</span> : 'Publish trip'}
              </button>
            </div>

            {trips && (
              <div style={{ marginTop: 10 }}>
                <div className="tray-hint">Published trips:</div>
                {trips.length === 0 && <div className="day-empty">none yet</div>}
                {trips.map((id) => (
                  <div key={id} className="loc-pick" style={{ display: 'flex', gap: 8 }}>
                    <strong style={{ flex: 1 }}>{id}</strong>
                    <span className="link" onClick={() => rotate(id)}>
                      change code
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function statusText(status: string, message: string) {
  if (status === 'saving') return 'saving…'
  if (status === 'saved') return 'all changes synced ✓'
  if (status === 'error') return `error: ${message}`
  if (status === 'conflict') return message
  return message || 'ready'
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
