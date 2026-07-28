// Client wrapper for the serverless sync API (see api/trips.ts).
// Trips are addressed purely by their 4-digit code. The API base defaults to the
// app's own origin (so a deployed visitor needs zero setup); it can be overridden
// in localStorage for local dev / pointing at a mock.

import type { Trip, Place } from '../types'

const API_KEY = 'tjp.cloudApi'
const OWNER_KEY = 'tjp.ownerKey'

/** Base URL of the sync API. Falls back to the current origin when unset. */
export function getCloudApi(): string {
  try {
    const stored = localStorage.getItem(API_KEY)
    if (stored && stored.trim()) return stored.replace(/\/$/, '')
  } catch {
    /* ignore */
  }
  return typeof window !== 'undefined' ? window.location.origin : ''
}
export function setCloudApi(url: string) {
  try {
    if (url.trim()) localStorage.setItem(API_KEY, url.replace(/\/$/, ''))
    else localStorage.removeItem(API_KEY)
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

export interface CloudTrip {
  name: string
  trip: Trip
  places: Place[]
  sha: string
}

async function call<T = any>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${getCloudApi()}/api/trips`, {
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

export function openTrip(code: string): Promise<CloudTrip> {
  return call<CloudTrip & { ok: true }>({ action: 'open', code })
}

export function saveTrip(
  code: string,
  trip: Trip,
  places: Place[],
  sha: string,
): Promise<{ ok: true; sha: string }> {
  return call({ action: 'save', code, trip, places, sha })
}

export function createTrip(
  ownerKey: string,
  code: string,
  trip: Trip,
  places: Place[],
): Promise<{ ok: true; sha: string }> {
  return call({ action: 'create', ownerKey, code, trip, places })
}

export function listTrips(ownerKey: string): Promise<{ ok: true; trips: string[] }> {
  return call({ action: 'list', ownerKey })
}
