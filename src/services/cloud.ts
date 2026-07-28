// Client wrapper for the serverless sync API (see api/trips.ts).
// The API base URL + owner key live in localStorage (owner key only on your device).

import type { Trip, Place } from '../types'

const API_KEY = 'tjp.cloudApi'
const OWNER_KEY = 'tjp.ownerKey'

export function getCloudApi(): string {
  try {
    return localStorage.getItem(API_KEY) ?? ''
  } catch {
    return ''
  }
}
export function setCloudApi(url: string) {
  try {
    localStorage.setItem(API_KEY, url.replace(/\/$/, ''))
  } catch {
    /* ignore */
  }
}
export function getOwnerKey(): string {
  try {
    return localStorage.getItem(OWNER_KEY) ?? ''
  } catch {
    return ''
  }
}
export function setOwnerKey(k: string) {
  try {
    localStorage.setItem(OWNER_KEY, k)
  } catch {
    /* ignore */
  }
}

export function cloudConfigured(): boolean {
  return getCloudApi().length > 0
}

export interface CloudTrip {
  name: string
  trip: Trip
  places: Place[]
  sha: string
}

async function call<T = any>(payload: Record<string, unknown>): Promise<T> {
  const base = getCloudApi()
  if (!base) throw new Error('Cloud API URL not set')
  const res = await fetch(`${base}/api/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
  if (!res.ok || data.ok === false) {
    const err: any = new Error(data.error || `HTTP ${res.status}`)
    err.status = res.status
    err.payload = data
    throw err
  }
  return data as T
}

export function openTrip(tripId: string, code: string): Promise<CloudTrip> {
  return call<CloudTrip & { ok: true }>({ action: 'open', tripId, code })
}

export function saveTrip(
  tripId: string,
  code: string,
  trip: Trip,
  places: Place[],
  sha: string,
): Promise<{ ok: true; sha: string }> {
  return call({ action: 'save', tripId, code, trip, places, sha })
}

export function createTrip(
  ownerKey: string,
  tripId: string,
  code: string,
  trip: Trip,
  places: Place[],
): Promise<{ ok: true; sha: string }> {
  return call({ action: 'create', ownerKey, tripId, code, trip, places })
}

export function listTrips(ownerKey: string): Promise<{ ok: true; trips: string[] }> {
  return call({ action: 'list', ownerKey })
}

export function setTripCode(
  ownerKey: string,
  tripId: string,
  code: string,
): Promise<{ ok: true }> {
  return call({ action: 'setcode', ownerKey, tripId, code })
}
