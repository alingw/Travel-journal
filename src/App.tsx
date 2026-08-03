import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTrip } from './store/tripStore'
import { JournalView } from './views/JournalView'
import { WishlistView } from './views/WishlistView'
import { MapView } from './views/MapView'
import { TodayView } from './views/TodayView'
import { PlaceEditor } from './components/PlaceEditor'
import { CloudPanel } from './components/CloudPanel'
import { SuggestPanel } from './components/SuggestPanel'
import { Landing } from './components/Landing'
import { useEditor } from './store/editorStore'
import { useCloud, isApplyingRemote } from './store/cloudStore'
import { dayNumLabel } from './utils/dates'

type Tab = 'journal' | 'wishlist' | 'map' | 'today'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'journal', label: 'Journal' },
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'map', label: 'Map' },
  { id: 'today', label: 'Today' },
]

export default function App() {
  const init = useTrip((s) => s.init)
  const loaded = useTrip((s) => s.loaded)
  const trip = useTrip((s) => s.trip)
  const exportJSON = useTrip((s) => s.exportJSON)
  const [tab, setTab] = useState<Tab>('journal')
  const [cloudOpen, setCloudOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const openEditor = useEditor((s) => s.openEditor)
  const cloudStatus = useCloud((s) => s.status)

  useEffect(() => {
    init()
    // Resume an open trip if one was active before reload.
    useCloud.getState().resume()
    // Autosave: push edits to the cloud while a trip is active.
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

  if (!loaded) return <div className="center-msg">loading…</div>
  if (!trip) return <Landing />

  return (
    <div className="app">
      <header className="header">
        <h1>{trip.name}</h1>
        <div className="sub">
          {trip.baseCity ? `${trip.baseCity} · ` : ''}
          {dayNumLabel(trip.startDate)} – {dayNumLabel(trip.endDate)}
        </div>
        <div className="tools">
          <button
            className="icon-btn"
            title={`Trip menu · ${cloudStatus}`}
            onClick={() => setCloudOpen(true)}
          >
            {cloudBadge(cloudStatus)}
          </button>
          <button
            className="icon-btn"
            title="Suggest a schedule (AI)"
            onClick={() => setSuggestOpen(true)}
          >
            ✦
          </button>
          <button className="icon-btn" title="Add a stop / event" onClick={() => openEditor()}>
            ＋
          </button>
          <button className="icon-btn" title="Export trip (JSON backup)" onClick={doExport}>
            ⬇
          </button>
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
      {suggestOpen && <SuggestPanel onClose={() => setSuggestOpen(false)} />}
    </div>
  )
}

// Status glyph for the trip menu button.
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
