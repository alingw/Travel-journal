// Device-local store for the day-journal scrapbook pages. Kept separate from the
// synced trip because the sticker/background images are far too large for the
// GitHub-backed trip file (its contents API caps inline content at ~1MB).

import { create } from 'zustand'
import type { DayJournal, JournalSticker } from '../types'
import { db } from './db'

const keyOf = (tripId: string, day: string) => `${tripId}::${day}`

function emptyJournal(tripId: string, day: string): DayJournal {
  return { key: keyOf(tripId, day), tripId, day, stickers: [], updatedAt: Date.now() }
}

interface JournalState {
  byKey: Record<string, DayJournal>
  loaded: Record<string, boolean>
  load: (tripId: string, day: string) => Promise<void>
  page: (tripId: string, day: string) => DayJournal
  setBackground: (tripId: string, day: string, background: string | undefined) => Promise<void>
  setCaption: (tripId: string, day: string, caption: string) => Promise<void>
  addSticker: (tripId: string, day: string, src: string, label?: string) => Promise<void>
  updateSticker: (tripId: string, day: string, id: string, patch: Partial<JournalSticker>) => Promise<void>
  removeSticker: (tripId: string, day: string, id: string) => Promise<void>
}

const uid = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export const useJournal = create<JournalState>((set, get) => ({
  byKey: {},
  loaded: {},

  async load(tripId, day) {
    const key = keyOf(tripId, day)
    if (get().loaded[key]) return
    const stored = await db.journal.get(key)
    set((s) => ({
      byKey: { ...s.byKey, [key]: stored ?? emptyJournal(tripId, day) },
      loaded: { ...s.loaded, [key]: true },
    }))
  },

  page(tripId, day) {
    return get().byKey[keyOf(tripId, day)] ?? emptyJournal(tripId, day)
  },

  async setBackground(tripId, day, background) {
    await commit(get, set, tripId, day, (j) => ({ ...j, background }))
  },

  async setCaption(tripId, day, caption) {
    await commit(get, set, tripId, day, (j) => ({ ...j, caption }))
  },

  async addSticker(tripId, day, src, label) {
    await commit(get, set, tripId, day, (j) => {
      const z = j.stickers.reduce((m, s) => Math.max(m, s.z), 0) + 1
      // Small random offset so freshly-added stickers don't stack exactly.
      const sticker: JournalSticker = {
        id: uid(),
        src,
        x: 0.5 + (Math.random() - 0.5) * 0.24,
        y: 0.5 + (Math.random() - 0.5) * 0.24,
        scale: 1,
        rot: (Math.random() - 0.5) * 16,
        z,
        label,
      }
      return { ...j, stickers: [...j.stickers, sticker] }
    })
  },

  async updateSticker(tripId, day, id, patch) {
    await commit(get, set, tripId, day, (j) => ({
      ...j,
      stickers: j.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  },

  async removeSticker(tripId, day, id) {
    await commit(get, set, tripId, day, (j) => ({
      ...j,
      stickers: j.stickers.filter((s) => s.id !== id),
    }))
  },
}))

async function commit(
  get: () => JournalState,
  set: (fn: (s: JournalState) => Partial<JournalState>) => void,
  tripId: string,
  day: string,
  update: (j: DayJournal) => DayJournal,
) {
  const key = keyOf(tripId, day)
  const cur = get().byKey[key] ?? emptyJournal(tripId, day)
  const next = { ...update(cur), updatedAt: Date.now() }
  set((s) => ({ byKey: { ...s.byKey, [key]: next } }))
  await db.journal.put(next)
}
