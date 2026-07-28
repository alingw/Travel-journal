// Central app store: the current trip + its places, persisted to IndexedDB.
// All mutations write through to Dexie so a reload restores exactly.

import { create } from 'zustand'
import type { Place, Trip, Category, PlaceStatus } from '../types'
import { db } from './db'
import { resolveStickerId } from '../services/stickers'

const uid = () =>
  `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/** Inclusive list of ISO day strings between the trip's start and end. */
export function tripDays(trip: Trip | null): string[] {
  if (!trip) return []
  const days: string[] = []
  const d = new Date(trip.startDate + 'T00:00:00')
  const end = new Date(trip.endDate + 'T00:00:00')
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

interface NewPlaceInput {
  name: string
  category: Category
  lat?: number
  lng?: number
  address?: string
  blurb?: string
  photoUrl?: string
  notes?: string
  startTime?: string
  status?: PlaceStatus
  dayDate?: string
}

interface TripState {
  trip: Trip | null
  places: Place[]
  loaded: boolean
  /** When true, a cloud trip is active: edits stay in memory + sync to GitHub,
      and are NOT written to the local IndexedDB (which holds your local trip). */
  cloudMode: boolean

  init: () => Promise<void>
  addPlace: (input: NewPlaceInput) => Promise<Place>
  updatePlace: (id: string, patch: Partial<Place>) => Promise<void>
  deletePlace: (id: string) => Promise<void>

  /** Move a place onto a day (schedules it). If index omitted, appends to the day. */
  assignToDay: (placeId: string, dayDate: string, index?: number) => Promise<void>
  /** Swap a scheduled place one slot earlier (-1) or later (+1) within its day. */
  moveInDay: (placeId: string, dir: -1 | 1) => Promise<void>
  /** Send a place back to the wishlist (unscheduled). */
  moveToWishlist: (placeId: string) => Promise<void>
  /** Duplicate an existing place as a new scheduled stop on a day (for re-adding). */
  copyPlaceToDay: (placeId: string, dayDate: string) => Promise<void>

  /** Swap in a cloud trip (snapshots the current local one to restore later). */
  enterCloud: (trip: Trip, places: Place[]) => void
  /** Leave cloud mode and restore the local trip. */
  exitCloud: () => void

  exportJSON: () => string
  importJSON: (json: string) => Promise<void>
}

// Held outside the store: the local trip snapshot to restore when leaving cloud mode.
let localSnapshot: { trip: Trip | null; places: Place[] } | null = null

// Sort a day's places by order and rewrite 0..n so ordering stays clean.
function normalizeOrders(places: Place[], dayDate: string): Place[] {
  const inDay = places
    .filter((p) => p.status === 'scheduled' && p.dayDate === dayDate)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  inDay.forEach((p, i) => (p.order = i))
  return places
}

export const useTrip = create<TripState>((set, get) => ({
  trip: null,
  places: [],
  loaded: false,
  cloudMode: false,

  async init() {
    // No local seed anymore: the app opens on the landing page until a trip is
    // opened by code or created. Trips live in the cloud (keyed by their code).
    if (get().loaded) return
    set({ loaded: true })
  },

  async addPlace(input) {
    const { trip } = get()
    if (!trip) throw new Error('No active trip')
    const place: Place = {
      id: uid(),
      tripId: trip.id,
      name: input.name,
      category: input.category,
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      blurb: input.blurb,
      photoUrl: input.photoUrl,
      notes: input.notes,
      startTime: input.startTime,
      stickerId: resolveStickerId(input.name, input.category),
      status: input.status ?? 'wishlist',
      dayDate: input.dayDate,
      order: input.dayDate
        ? get().places.filter((p) => p.dayDate === input.dayDate).length
        : undefined,
    }
    if (!get().cloudMode) await db.places.put(place)
    set({ places: [...get().places, place] })
    return place
  },

  async updatePlace(id, patch) {
    const places = get().places.map((p) => (p.id === id ? { ...p, ...patch } : p))
    const updated = places.find((p) => p.id === id)
    if (updated && !get().cloudMode) await db.places.put(updated)
    set({ places })
  },

  async deletePlace(id) {
    if (!get().cloudMode) await db.places.delete(id)
    set({ places: get().places.filter((p) => p.id !== id) })
  },

  async assignToDay(placeId, dayDate, index) {
    let places = get().places.map((p) => ({ ...p }))
    const place = places.find((p) => p.id === placeId)
    if (!place) return
    const fromDay = place.dayDate

    place.status = 'scheduled'
    place.dayDate = dayDate
    // Place it at a fractional order so normalize can slot it correctly.
    if (index === undefined) {
      const max = Math.max(
        -1,
        ...places
          .filter((p) => p.status === 'scheduled' && p.dayDate === dayDate && p.id !== placeId)
          .map((p) => p.order ?? 0),
      )
      place.order = max + 1
    } else {
      place.order = index - 0.5
    }

    places = normalizeOrders(places, dayDate)
    if (fromDay && fromDay !== dayDate) places = normalizeOrders(places, fromDay)

    if (!get().cloudMode) await db.places.bulkPut(places)
    set({ places })
  },

  async moveInDay(placeId, dir) {
    const places = get().places.map((p) => ({ ...p }))
    const p = places.find((x) => x.id === placeId)
    if (!p || p.status !== 'scheduled' || !p.dayDate) return
    const list = places
      .filter((x) => x.status === 'scheduled' && x.dayDate === p.dayDate)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const idx = list.findIndex((x) => x.id === placeId)
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    // Swap the two neighbours' order values, then normalize to clean 0..n.
    const a = list[idx]
    const b = list[target]
    const ao = a.order ?? idx
    a.order = b.order ?? target
    b.order = ao
    const normalized = normalizeOrders(places, p.dayDate)
    if (!get().cloudMode) await db.places.bulkPut(normalized)
    set({ places: normalized })
  },

  async moveToWishlist(placeId) {
    let places = get().places.map((p) => ({ ...p }))
    const place = places.find((p) => p.id === placeId)
    if (!place) return
    const fromDay = place.dayDate
    place.status = 'wishlist'
    place.dayDate = undefined
    place.order = undefined
    if (fromDay) places = normalizeOrders(places, fromDay)
    if (!get().cloudMode) await db.places.bulkPut(places)
    set({ places })
  },

  async copyPlaceToDay(placeId, dayDate) {
    const src = get().places.find((p) => p.id === placeId)
    if (!src) return
    await get().addPlace({
      name: src.name,
      category: src.category,
      lat: src.lat,
      lng: src.lng,
      address: src.address,
      blurb: src.blurb,
      photoUrl: src.photoUrl,
      notes: src.notes,
      startTime: src.startTime,
      status: 'scheduled',
      dayDate,
    })
  },

  enterCloud(trip, places) {
    if (!get().cloudMode) {
      localSnapshot = { trip: get().trip, places: get().places }
    }
    set({ trip, places, cloudMode: true })
  },

  exitCloud() {
    if (localSnapshot) {
      set({ trip: localSnapshot.trip, places: localSnapshot.places, cloudMode: false })
      localSnapshot = null
    } else {
      set({ cloudMode: false })
    }
  },

  exportJSON() {
    const { trip, places } = get()
    return JSON.stringify({ version: 1, trip, places }, null, 2)
  },

  async importJSON(json) {
    const data = JSON.parse(json) as { trip: Trip; places: Place[] }
    if (!data.trip || !Array.isArray(data.places)) throw new Error('Invalid file')
    await db.trips.put(data.trip)
    await db.places.bulkPut(data.places)
    set({ trip: data.trip, places: data.places })
  },
}))
