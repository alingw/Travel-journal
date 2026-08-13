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
  // ---- Shared expense splitter (all optional; older trips simply lack them) ----
  currency?: string // symbol shown next to amounts, defaults to "$"
  participants?: string[] // people splitting costs on this trip
  expenses?: Expense[] // everything anyone has paid so far
}

// One payment somebody made, split equally among `sharedBy` (go-Dutch).
export interface Expense {
  id: string
  title: string
  amount: number // total paid, in the trip currency
  paidBy: string // participant name who fronted the money
  sharedBy: string[] // participants splitting it (equal shares)
  date?: string // ISO yyyy-mm-dd
  createdBy?: string // which device/person entered it (informational)
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

// ---- Day journal (the scrapbook canvas on the Today tab) ----
// Stored locally on the device (images are too large for the synced trip file).
export interface JournalSticker {
  id: string
  src: string // data URL (png, transparent)
  x: number // 0..1, center position relative to the canvas
  y: number // 0..1
  scale: number // size multiplier (1 = base)
  rot: number // rotation in degrees
  z: number // stacking order
  hidden?: boolean // toggled off (kept in the tray)
  label?: string
}

export interface DayJournal {
  key: string // `${tripId}::${day}`
  tripId: string
  day: string // ISO yyyy-mm-dd
  background?: string // data URL (jpeg) OR a built-in texture id like "paper:cream"
  stickers: JournalSticker[]
  caption?: string // handwritten note for the day
  updatedAt: number
}

// A saved, reusable image (generated sticker or background) at the trip level, so
// it can be dropped onto any day again. Device-local, like DayJournal.
export interface Asset {
  id: string
  tripId: string
  kind: 'sticker' | 'background'
  src: string // data URL
  createdAt: number
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
