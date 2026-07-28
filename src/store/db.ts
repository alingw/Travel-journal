// IndexedDB persistence via Dexie. Local-first: everything lives on the device.

import Dexie, { type Table } from 'dexie'
import type { Trip, Place } from '../types'

export class TripDB extends Dexie {
  trips!: Table<Trip, string>
  places!: Table<Place, string>

  constructor() {
    super('travel-journal')
    this.version(1).stores({
      trips: 'id',
      places: 'id, tripId, status, dayDate',
    })
  }
}

export const db = new TripDB()
