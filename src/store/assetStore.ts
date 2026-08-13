// Device-local library of reusable images (generated stickers + backgrounds),
// per trip. Lets you drop a previously-generated sticker/background onto any day
// again. Kept out of the synced trip file for the same size reason as journals.

import { create } from 'zustand'
import type { Asset } from '../types'
import { db } from './db'

const uid = () => `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

interface AssetState {
  byTrip: Record<string, Asset[]>
  loaded: Record<string, boolean>
  load: (tripId: string) => Promise<void>
  list: (tripId: string, kind: Asset['kind']) => Asset[]
  addMany: (tripId: string, kind: Asset['kind'], srcs: string[]) => Promise<Asset[]>
  remove: (tripId: string, id: string) => Promise<void>
}

export const useAssets = create<AssetState>((set, get) => ({
  byTrip: {},
  loaded: {},

  async load(tripId) {
    if (get().loaded[tripId]) return
    const rows = await db.assets.where('tripId').equals(tripId).toArray()
    rows.sort((a, b) => b.createdAt - a.createdAt)
    set((s) => ({ byTrip: { ...s.byTrip, [tripId]: rows }, loaded: { ...s.loaded, [tripId]: true } }))
  },

  list(tripId, kind) {
    return (get().byTrip[tripId] ?? []).filter((a) => a.kind === kind)
  },

  async addMany(tripId, kind, srcs) {
    const now = Date.now()
    const items: Asset[] = srcs.map((src, i) => ({
      id: uid(),
      tripId,
      kind,
      src,
      createdAt: now + i, // preserve order; newest first after sort
    }))
    await db.assets.bulkPut(items)
    set((s) => ({
      byTrip: { ...s.byTrip, [tripId]: [...items].reverse().concat(s.byTrip[tripId] ?? []) },
    }))
    return items
  },

  async remove(tripId, id) {
    await db.assets.delete(id)
    set((s) => ({ byTrip: { ...s.byTrip, [tripId]: (s.byTrip[tripId] ?? []).filter((a) => a.id !== id) } }))
  },
}))
