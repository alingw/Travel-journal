import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTrip } from './store/tripStore'
import { JournalView } from './views/JournalView'
import { WishlistView } from './views/WishlistView'
import { MapView } from './views/MapView'
import { TodayView } from './views/TodayView'
import { PlaceEditor } from './components/PlaceEditor'
import { CloudPanel } from './components/CloudPanel'
import { useEditor } from './store/editorStore'
import { useCloud, isApplyingRemote } from './store/cloudStore'
import { dayNumLabel } from './utils/dates'

type Tab = 'journal' | 'wishlist' | 'map' | 'today'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'journal', label: '📖 Journal' },
  { id: 'wishlist', label: '📌 Wishlist' },
  { id: 'map', label: '🗺️ Map' },
  { id: 'today', label: '⭐ Today' },
]

export default function App() {
  const init = useTrip((s) => s.init)
  const loaded = useTrip((s) => s.loaded)
  const trip = useTrip((s) => s.trip)
  const exportJSON = useTrip((s) => s.exportJSON)
  const importJSON = useTrip((s) => s.importJSON)
  const [tab, setTab] = useState<Tab>('journal')
  const [cloudOpen, setCloudOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const openEditor = useEditor((s) => s.openEditor)
  const cloudMode = useTrip((s) => s.cloudMode)
  const cloudStatus = useCloud((s) => s.status)

  useEffect(() => {
    init()
    // Resume a cloud session if one was open before reload.
    useCloud.getState().resume()
    // Autosave: push local edits to the cloud while a cloud trip is active.
    const unsub = useTrip.subscribe((state, prev) => {
      if (!state.cloudMode || isApplyingRemote()) return
      if (state.places !== prev.places || state.trip !== prev.trip) {
        useCloud.getState().scheduleSave()
      }
    })
    return unsub
  }, [init])

  function doExport() {
    const blob = new Blob([exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip?.name ?? 'trip'}.json`.replace(/\s+/g, '-').toLowerCase()
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport(file: File) {
    try {
      await importJSON(await file.text())
    } catch (e: any) {
      alert('Could not import: ' + (e?.message ?? 'invalid file'))
    }
  }

  if (!loaded) return <div className="center-msg">opening the journal…</div>
  if (!trip) return <div className="center-msg">no trip yet</div>

  return (
    <div className="app">
      <header className="header">
        <h1>{trip.name}</h1>
        <div className="sub">
          {trip.baseCity} · {dayNumLabel(trip.startDate)} – {dayNumLabel(trip.endDate)}
        </div>
        <div className="tools">
          <button
            className="icon-btn"
            title={cloudMode ? `Cloud: ${cloudStatus}` : 'Cloud sync (share/edit via GitHub)'}
            onClick={() => setCloudOpen(true)}
          >
            {cloudMode ? cloudBadge(cloudStatus) : '☁'}
          </button>
          <button className="icon-btn" title="Add a stop / event" onClick={() => openEditor()}>
            ＋
          </button>
          <button className="icon-btn" title="Export trip (JSON backup)" onClick={doExport}>
            ⬇
          </button>
          <button
            className="icon-btn"
            title="Import trip"
            onClick={() => fileRef.current?.click()}
          >
            ⬆
          </button>
          <input
            ref={fileRef}
            className="hidden-file"
            type="file"
            accept="application/json"
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="view">
        {/* Keyed remount plays an enter animation per tab. No AnimatePresence /
            exit animation — mode="wait" exits can stall in React 18 StrictMode. */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          style={{ height: '100%' }}
        >
          {tab === 'journal' && <JournalView />}
          {tab === 'wishlist' && <WishlistView />}
          {tab === 'map' && <MapView />}
          {tab === 'today' && <TodayView />}
        </motion.div>
      </main>

      <PlaceEditor />
      {cloudOpen && <CloudPanel onClose={() => setCloudOpen(false)} />}
    </div>
  )
}

// Small status glyph for the cloud button when a cloud trip is active.
function cloudBadge(status: string): string {
  switch (status) {
    case 'saving':
      return '☁…'
    case 'saved':
      return '☁✓'
    case 'error':
      return '☁!'
    case 'conflict':
      return '☁⚠'
    default:
      return '☁'
  }
}
