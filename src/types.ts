// Shared data model for the whole app. Kept intentionally small — see the plan.

export type Category =
  | 'arrival'
  | 'lodging'
  | 'event'
  | 'sight'
  | 'food'
  | 'transport'
  | 'other'

export type PlaceStatus = 'wishlist' | 'scheduled'

export interface Trip {
  id: string
  name: string
  baseCity: string
  startDate: string // ISO yyyy-mm-dd
  endDate: string // ISO yyyy-mm-dd
}

export interface Place {
  id: string
  tripId: string
  name: string
  category: Category
  // Optional: a custom event (e.g. "Lunch break") may have no map location.
  lat?: number
  lng?: number
  address?: string
  blurb?: string
  photoUrl?: string
  notes?: string
  stickerId: string
  status: PlaceStatus
  dayDate?: string // ISO yyyy-mm-dd, only when status === 'scheduled'
  order?: number // ordering within a day
  startTime?: string // "HH:mm", optional
}

export const CATEGORY_LABELS: Record<Category, string> = {
  arrival: 'Arrival',
  lodging: 'Stay',
  event: 'Event',
  sight: 'Sight',
  food: 'Food',
  transport: 'Transport',
  other: 'Other',
}
