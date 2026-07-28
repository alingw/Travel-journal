import { useState } from 'react'
import { useCloud } from '../store/cloudStore'
import { getOwnerKey, setOwnerKey, getCloudApi, setCloudApi, listTrips } from '../services/cloud'

// Trip menu for the active (cloud) trip: share its code, leave/switch, and owner
// tools. Opening & creating trips happen on the landing page, not here.
export function CloudPanel({ onClose }: { onClose: () => void }) {
  const session = useCloud((s) => s.session)
  const status = useCloud((s) => s.status)
  const message = useCloud((s) => s.message)
  const leave = useCloud((s) => s.leave)

  const [ownerKey, setOwner] = useState(getOwnerKey())
  const [api, setApi] = useState(getCloudApi())
  const [trips, setTrips] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  async function doList() {
    setErr('')
    setBusy(true)
    try {
      setOwnerKey(ownerKey.trim())
      const r = await listTrips(ownerKey.trim())
      setTrips(r.trips)
    } catch (e: any) {
      setErr(e?.message ?? 'could not list')
    } finally {
      setBusy(false)
    }
  }

  function copyCode() {
    if (!session) return
    navigator.clipboard?.writeText(session.code).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>☁ Trip menu</h3>

        {session && (
          <div className="code-box">
            <div className="landing-hint">Share this code so others can open & edit:</div>
            <div className="code-big">{session.code}</div>
            <div className="modal-actions" style={{ marginTop: 6 }}>
              <span className="landing-hint">{statusText(status, message)}</span>
              <div className="spacer" />
              <button className="btn ghost" onClick={copyCode}>
                {copied ? '✓ copied' : 'Copy code'}
              </button>
              <button
                className="btn"
                onClick={() => {
                  leave()
                  onClose()
                }}
              >
                Leave / switch trip
              </button>
            </div>
          </div>
        )}

        {err && <div className="banner">{err}</div>}

        <div className="section-title" style={{ fontSize: '1.15rem', marginTop: 14 }}>
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
        <button className="mini-btn" disabled={busy} onClick={doList}>
          {busy ? <span className="spin">↻</span> : 'List my trip codes'}
        </button>
        {trips && (
          <div style={{ marginTop: 8 }}>
            {trips.length === 0 && <div className="day-empty">none yet</div>}
            {trips.map((c) => (
              <div key={c} className="loc-pick" style={{ cursor: 'default' }}>
                <strong>{c}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="field" style={{ marginTop: 14 }}>
          <label>Sync service URL (advanced)</label>
          <input type="text" value={api} onChange={(e) => setApi(e.target.value)} onBlur={() => setCloudApi(api)} />
          <div className="landing-hint">Defaults to this site; change only for local testing.</div>
        </div>

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

function statusText(status: string, message: string) {
  if (status === 'saving') return 'saving…'
  if (status === 'saved') return 'all changes synced ✓'
  if (status === 'error') return `error: ${message}`
  if (status === 'conflict') return message
  return message || 'ready'
}
