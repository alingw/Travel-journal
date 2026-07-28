import { useState } from 'react'
import { useCloud } from '../store/cloudStore'
import {
  getOwnerKey,
  setOwnerKey,
  getCloudApi,
  setCloudApi,
} from '../services/cloud'
import type { Trip, Place } from '../types'
import { todayIso } from '../utils/dates'

// The intro / gate. Either open an existing trip with its 4-digit code, or (owner
// only) create a new one. The journal is shown only once a trip is active.
export function Landing() {
  const open = useCloud((s) => s.open)
  const create = useCloud((s) => s.create)

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [mode, setMode] = useState<'home' | 'create' | 'advanced'>('home')

  async function doOpen() {
    setErr('')
    if (!/^\d{4}$/.test(code)) return setErr('Enter your 4-digit code')
    setBusy(true)
    try {
      await open(code)
    } catch (e: any) {
      setErr(e?.message ?? 'could not open')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="landing-brand">
          <span className="landing-sticker">🧳</span>
          <h1>Travel Journal</h1>
          <div className="landing-tag">a hand-drawn planner for your trips</div>
        </div>

        {err && <div className="banner">{err}</div>}

        {mode === 'home' && (
          <>
            <div className="landing-section">
              <label>Open a trip</label>
              <div className="landing-row">
                <input
                  className="code-input"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={code}
                  placeholder="1234"
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && doOpen()}
                />
                <button className="btn" disabled={busy} onClick={doOpen}>
                  {busy ? <span className="spin">↻</span> : 'Open →'}
                </button>
              </div>
              <div className="landing-hint">Type the 4-digit code someone shared with you.</div>
            </div>

            <div className="landing-or">— or —</div>

            <button className="btn ghost landing-create" onClick={() => setMode('create')}>
              ＋ Create a new trip
            </button>

            <div className="landing-foot">
              <span className="link" onClick={() => setMode('advanced')}>
                advanced
              </span>
            </div>
          </>
        )}

        {mode === 'create' && (
          <CreateForm
            onBack={() => {
              setErr('')
              setMode('home')
            }}
            onCreate={create}
          />
        )}

        {mode === 'advanced' && <Advanced onBack={() => setMode('home')} />}
      </div>
    </div>
  )
}

function CreateForm({
  onBack,
  onCreate,
}: {
  onBack: () => void
  onCreate: (ownerKey: string, code: string, trip: Trip, places: Place[]) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [baseCity, setBaseCity] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState(todayIso())
  const [code, setCode] = useState(String(Math.floor(1000 + Math.random() * 9000)))
  const [ownerKey, setOwner] = useState(getOwnerKey())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    if (!name.trim()) return setErr('Give your trip a name')
    if (!/^\d{4}$/.test(code)) return setErr('Code must be 4 digits')
    if (endDate < startDate) return setErr('End date is before start date')
    if (!ownerKey.trim()) return setErr('Owner key required to create a trip')
    setBusy(true)
    setOwnerKey(ownerKey.trim())
    const trip: Trip = {
      id: code,
      name: name.trim(),
      baseCity: baseCity.trim(),
      startDate,
      endDate,
    }
    try {
      await onCreate(ownerKey.trim(), code, trip, [])
    } catch (e: any) {
      setErr(e?.message ?? 'could not create')
      setBusy(false)
    }
  }

  return (
    <div className="landing-section">
      <label>Create a new trip</label>
      {err && <div className="banner">{err}</div>}
      <div className="field">
        <input type="text" placeholder="Trip name (e.g. US Open 2026)" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <input type="text" placeholder="Base city (e.g. New York)" value={baseCity} onChange={(e) => setBaseCity(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Start</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>End</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '0 0 96px' }}>
          <label>Code</label>
          <input
            className="code-input sm"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      <div className="field">
        <label>Owner key</label>
        <input type="password" placeholder="your secret owner key" value={ownerKey} onChange={(e) => setOwner(e.target.value)} />
      </div>
      <div className="landing-hint">Share the trip's 4-digit code with anyone you want to let edit.</div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="spacer" />
        <button className="btn" disabled={busy} onClick={submit}>
          {busy ? <span className="spin">↻</span> : 'Create & open'}
        </button>
      </div>
    </div>
  )
}

function Advanced({ onBack }: { onBack: () => void }) {
  const [api, setApi] = useState(getCloudApi())
  return (
    <div className="landing-section">
      <label>Advanced</label>
      <div className="field">
        <label>Sync service URL</label>
        <input
          type="text"
          value={api}
          onChange={(e) => setApi(e.target.value)}
          onBlur={() => setCloudApi(api)}
        />
        <div className="landing-hint">
          Defaults to this site. Only change it for local testing (e.g. a mock server).
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  )
}
