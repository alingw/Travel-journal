// Cloud session state: which trip (by 4-digit code) is open from GitHub, plus the
// autosave lifecycle. Data flows through tripStore (enterCloud/exitCloud).

import { create } from 'zustand'
import { useTrip } from './tripStore'
import type { Trip, Place } from '../types'
import * as cloud from '../services/cloud'

const SESSION_KEY = 'tjp.cloudSession'

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict'

interface Session {
  code: string
  sha: string
}

interface CloudState {
  session: Session | null
  status: Status
  message: string
  open: (code: string) => Promise<void>
  create: (ownerKey: string, code: string, trip: Trip, places: Place[]) => Promise<void>
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

// True while we apply data pulled FROM the cloud, so the autosave subscription in
// App can ignore those store changes (they aren't user edits).
let applyingRemote = false
export const isApplyingRemote = () => applyingRemote
function applyRemote(trip: Trip, places: Place[]) {
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

  async open(code) {
    set({ status: 'loading', message: 'opening…' })
    try {
      const res = await cloud.openTrip(code)
      applyRemote(res.trip, res.places)
      const session = { code, sha: res.sha }
      set({ session, status: 'saved', message: 'synced' })
      persist(session)
    } catch (e: any) {
      set({ status: 'error', message: e?.message ?? 'could not open' })
      throw e
    }
  },

  async create(ownerKey, code, trip, places) {
    set({ status: 'saving', message: 'creating…' })
    try {
      const res = await cloud.createTrip(ownerKey, code, trip, places)
      applyRemote(trip, places)
      const session = { code, sha: res.sha }
      set({ session, status: 'saved', message: 'created & synced' })
      persist(session)
    } catch (e: any) {
      set({ status: 'error', message: e?.message ?? 'could not create' })
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
      const res = await cloud.saveTrip(session.code, trip, places, session.sha)
      const next = { ...session, sha: res.sha }
      set({ session: next, status: 'saved', message: 'synced' })
      persist(next)
    } catch (e: any) {
      // Another editor saved first → adopt their version so we don't clobber it.
      if (e?.status === 409 && e?.payload?.latest) {
        const latest = e.payload.latest
        applyRemote(latest.trip, latest.places)
        const next = { ...session, sha: latest.sha }
        set({ session: next, status: 'conflict', message: 'another editor saved — reloaded theirs' })
        persist(next)
      } else {
        set({ status: 'error', message: e?.message ?? 'save failed' })
      }
    }
  },

  async resume() {
    const persisted = readPersisted()
    if (!persisted) return
    try {
      await get().open(persisted.code)
    } catch {
      persist(null)
      set({ session: null, status: 'idle', message: '' })
    }
  },
}))
