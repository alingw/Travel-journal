// IndexedDB persistence via Dexie. Local-first: everything lives on the device.

import Dexie, { type Table } from 'dexie'
import type { Trip, Place, DayJournal, Asset } from '../types'

export class TripDB extends Dexie {
  trips!: Table<Trip, string>
  places!: Table<Place, string>
  journal!: Table<DayJournal, string>
  assets!: Table<Asset, string>

  constructor() {
    super('travel-journal')
    this.version(1).stores({
      trips: 'id',
      places: 'id, tripId, status, dayDate',
    })
    // v2: day-journal scrapbook pages (device-local; images stay off the sync file)
    this.version(2).stores({
      trips: 'id',
      places: 'id, tripId, status, dayDate',
      journal: 'key, tripId',
    })
    // v3: reusable per-trip sticker/background library (also device-local)
    this.version(3).stores({
      trips: 'id',
      places: 'id, tripId, status, dayDate',
      journal: 'key, tripId',
      assets: 'id, tripId, kind',
    })
  }
}

export const db = new TripDB()
