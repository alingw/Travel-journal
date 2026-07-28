// Cloud session state: which trip is open from GitHub, its 4-digit code, and the
// autosave lifecycle. Data flows through tripStore (enterCloud/exitCloud); this
// store just orchestrates open / publish / save + status.

import { create } from 'zustand'
import { useTrip } from './tripStore'
import * as cloud from '../services/cloud'

const SESSION_KEY = 'tjp.cloudSession'

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict'

interface Session {
  tripId: string
  code: string
  sha: string
}

interface CloudState {
  session: Session | null
  status: Status
  message: string
  open: (tripId: string, code: string) => Promise<void>
  publish: (ownerKey: string, tripId: string, code: string) => Promise<void>
  leave: () => void
  scheduleSave: () => void
  saveNow: () => Promise<void>
  resume: () => Promise<void>
}

function persist(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
function readPersisted(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

// True while we apply data pulled FROM the cloud, so the autosave subscription
// in App can ignore those store changes (they aren't user edits).
let applyingRemote = false
export const isApplyingRemote = () => applyingRemote
function applyRemote(trip: any, places: any) {
  applyingRemote = true
  try {
    useTrip.getState().enterCloud(trip, places)
  } finally {
    applyingRemote = false
  }
}

export const useCloud = create<CloudState>((set, get) => ({
  session: null,
  status: 'idle',
  message: '',

  async open(tripId, code) {
    set({ status: 'loading', message: 'opening…' })
    try {
      const res = await cloud.openTrip(tripId, code)
      applyRemote(res.trip, res.places)
      const session = { tripId, code, sha: res.sha }
      set({ session, status: 'saved', message: 'synced' })
      persist(session)
    } catch (e: any) {
      set({ status: 'error', message: e?.message ?? 'could not open' })
      throw e
    }
  },

  async publish(ownerKey, tripId, code) {
    const { trip, places } = useTrip.getState()
    if (!trip) throw new Error('No trip to publish')
    set({ status: 'saving', message: 'publishing…' })
    try {
      const res = await cloud.createTrip(ownerKey, tripId, code, { ...trip, id: tripId }, places)
      // Continue editing this trip in cloud mode so further edits sync.
      applyRemote({ ...trip, id: tripId }, places)
      const session = { tripId, code, sha: res.sha }
      set({ session, status: 'saved', message: 'published & synced' })
      persist(session)
    } catch (e: any) {
      set({ status: 'error', message: e?.message ?? 'could not publish' })
      throw e
    }
  },

  leave() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    useTrip.getState().exitCloud()
    set({ session: null, status: 'idle', message: '' })
    persist(null)
  },

  scheduleSave() {
    if (!get().session) return
    set({ status: 'saving', message: 'saving…' })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      get().saveNow()
    }, 1200)
  },

  async saveNow() {
    const session = get().session
    if (!session) return
    const { trip, places } = useTrip.getState()
    if (!trip) return
    try {
      const res = await cloud.saveTrip(session.tripId, session.code, trip, places, session.sha)
      const next = { ...session, sha: res.sha }
      set({ session: next, status: 'saved', message: 'synced' })
      persist(next)
    } catch (e: any) {
      // Another editor saved first → adopt their version so we don't clobber it.
      if (e?.status === 409 && e?.payload?.latest) {
        const latest = e.payload.latest
        applyRemote(latest.trip, latest.places)
        const next = { ...session, sha: latest.sha }
        set({
          session: next,
          status: 'conflict',
          message: 'another editor saved — reloaded their version',
        })
        persist(next)
      } else {
        set({ status: 'error', message: e?.message ?? 'save failed' })
      }
    }
  },

  async resume() {
    const persisted = readPersisted()
    if (!persisted || !cloud.cloudConfigured()) return
    try {
      await get().open(persisted.tripId, persisted.code)
    } catch {
      // Code/trip no longer valid — drop the stale session silently.
      persist(null)
      set({ session: null, status: 'idle', message: '' })
    }
  },
}))
