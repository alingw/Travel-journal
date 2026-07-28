// First-run seed: the US Open 2026 example trip (New York, Aug 23–27).
// Real coordinates so the watercolor map + route look right out of the box.

import type { Trip, Place } from '../types'
import { resolveStickerId } from '../services/stickers'

export const SEED_TRIP: Trip = {
  id: 'trip-usopen-2026',
  name: 'US Open 2026',
  baseCity: 'New York, USA',
  startDate: '2026-08-23',
  endDate: '2026-08-27',
}

type SeedPlace = Omit<Place, 'tripId' | 'stickerId'>

const RAW: SeedPlace[] = [
  // --- Day 1: Sun Aug 23 (arrive + opening night) ---
  {
    id: 'p-jfk',
    name: 'JFK Airport — Arrival',
    category: 'arrival',
    lat: 40.6413,
    lng: -73.7781,
    address: 'Queens, NY',
    blurb: 'Land, grab the AirTrain, and head into the city.',
    status: 'scheduled',
    dayDate: '2026-08-23',
    order: 0,
    startTime: '14:30',
  },
  {
    id: 'p-hotel',
    name: 'Pod 51 Hotel (check-in)',
    category: 'lodging',
    lat: 40.7566,
    lng: -73.97,
    address: '230 E 51st St, Midtown',
    blurb: 'Drop the bags, freshen up before the night session.',
    notes: 'Ask for a room away from the street 🤫',
    status: 'scheduled',
    dayDate: '2026-08-23',
    order: 1,
    startTime: '16:00',
  },
  {
    id: 'p-ashe',
    name: 'Arthur Ashe Stadium — Night Session',
    category: 'event',
    lat: 40.7499,
    lng: -73.8448,
    address: 'USTA Billie Jean King NTC, Flushing',
    blurb: 'Opening-night session under the lights at the biggest tennis stadium in the world.',
    notes: 'Tickets in the phone wallet! Gates 7pm.',
    status: 'scheduled',
    dayDate: '2026-08-23',
    order: 2,
    startTime: '19:00',
  },

  // --- Day 2: Mon Aug 24 (bagel + day session) ---
  {
    id: 'p-essabagel',
    name: 'Ess-a-Bagel (breakfast)',
    category: 'food',
    lat: 40.7529,
    lng: -73.9705,
    address: '831 3rd Ave, Midtown',
    blurb: 'Legendary fat, chewy NYC bagels. Get there before the line.',
    status: 'scheduled',
    dayDate: '2026-08-24',
    order: 0,
    startTime: '08:30',
  },
  {
    id: 'p-armstrong',
    name: 'Louis Armstrong Stadium — Day Session',
    category: 'event',
    lat: 40.7486,
    lng: -73.8475,
    address: 'USTA Billie Jean King NTC, Flushing',
    blurb: 'Second show court — great sightlines and a retractable roof.',
    status: 'scheduled',
    dayDate: '2026-08-24',
    order: 1,
    startTime: '12:00',
  },

  // --- Wishlist: maybe, if there's time ---
  {
    id: 'p-nanxiang',
    name: 'Nan Xiang Xiao Long Bao (Flushing)',
    category: 'food',
    lat: 40.7591,
    lng: -73.8302,
    address: '39-16 Prince St, Flushing',
    blurb: 'Soup dumplings a short walk from the tennis — perfect post-match dinner.',
    status: 'wishlist',
  },
  {
    id: 'p-vessel',
    name: 'The Vessel — Hudson Yards',
    category: 'sight',
    lat: 40.7538,
    lng: -74.0021,
    address: '20 Hudson Yards',
    blurb: 'Honeycomb of climbable staircases with skyline views.',
    status: 'wishlist',
  },
  {
    id: 'p-centralpark',
    name: 'Central Park',
    category: 'sight',
    lat: 40.7829,
    lng: -73.9654,
    address: 'Manhattan',
    blurb: 'A morning stroll before the crowds — Bethesda Terrace, the Mall, the Lake.',
    status: 'wishlist',
  },
  {
    id: 'p-met',
    name: 'The Metropolitan Museum of Art',
    category: 'sight',
    lat: 40.7794,
    lng: -73.9632,
    address: '1000 5th Ave',
    blurb: 'One of the great museums — pay-what-you-wish for NY State residents.',
    status: 'wishlist',
  },
]

export function seedPlaces(tripId: string): Place[] {
  return RAW.map((p) => ({
    ...p,
    tripId,
    stickerId: resolveStickerId(p.name, p.category),
  }))
}
