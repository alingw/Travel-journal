// Client for the AI schedule-suggestion endpoint, plus local storage for saved
// suggestion "chats" (kept per-trip so you can review them later).
import type { Trip, Place } from '../types'
import { getCloudApi } from './cloud'

export interface Assignment {
  placeId: string
  dayDate: string
  order: number
  startTime: string
}

export interface Suggestion {
  id: string
  createdAt: number
  reasoning: string
  assignments: Assignment[]
}

/** Ask the AI for the best schedule given the current trip + places. */
export async function suggestSchedule(
  trip: Trip,
  places: Place[],
  days: string[],
): Promise<{ reasoning: string; assignments: Assignment[] }> {
  const res = await fetch(`${getCloudApi()}/api/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trip, places, days }),
  })
  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`)
  return { reasoning: data.reasoning ?? '', assignments: data.assignments ?? [] }
}

// ---- saved suggestions (localStorage, keyed by trip id/code) ----
const keyFor = (tripId: string) => `tjp.suggestions.${tripId}`

export function getSavedSuggestions(tripId: string): Suggestion[] {
  try {
    const raw = localStorage.getItem(keyFor(tripId))
    return raw ? (JSON.parse(raw) as Suggestion[]) : []
  } catch {
    return []
  }
}

export function saveSuggestion(
  tripId: string,
  s: { reasoning: string; assignments: Assignment[] },
): Suggestion {
  const entry: Suggestion = {
    id: `s-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    reasoning: s.reasoning,
    assignments: s.assignments,
  }
  const all = [entry, ...getSavedSuggestions(tripId)].slice(0, 20)
  try {
    localStorage.setItem(keyFor(tripId), JSON.stringify(all))
  } catch {
    /* ignore */
  }
  return entry
}

export function deleteSavedSuggestion(tripId: string, id: string): void {
  const all = getSavedSuggestions(tripId).filter((s) => s.id !== id)
  try {
    localStorage.setItem(keyFor(tripId), JSON.stringify(all))
  } catch {
    /* ignore */
  }
}
