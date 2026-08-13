// IndexedDB persistence via Dexie. Local-first: everything lives on the device.

import Dexie, { type Table } from 'dexie'
import type { Trip, Place, DayJournal } from '../types'

export class TripDB extends Dexie {
  trips!: Table<Trip, string>
  places!: Table<Place, string>
  journal!: Table<DayJournal, string>

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
  }
}

export const db = new TripDB()
