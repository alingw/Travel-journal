# Travel Journal Planner 🧳🎨

A hand-drawn **travel journal & planner** PWA. Plan where to go and where to eat,
pin "maybe" places, and see the whole trip on an animated watercolor map — with
sticker pins, handwritten notes, and drag-to-schedule. 

## Features
- **📖 Journal** — a page per day with handwritten notes, stickers, and times.
- **📌 Wishlist** — search real places (OpenStreetMap) and pin maybe-visits; each
  gets a Wikipedia blurb + photo and an auto-matched watercolor sticker.
- **🗺️ Map** — watercolor map with sticker markers and a route that draws itself;
  filter by day or see the whole journey.
- **⭐ Today** — live/travel mode: drag a wishlist pin into the day to add a stop
  on the fly. Reorder with ▲▼, set times, add notes.
- **Local-first** — everything is stored on-device (IndexedDB). Works offline.
  Back up / restore with the ⬇ / ⬆ buttons (JSON export/import).
- **☁ Cloud sync (optional)** — publish a trip to a private GitHub repo and let others
  open + edit it with a **4-digit code**; edits autosave and sync for everyone. Setup:
  see **[SETUP-SYNC.md](SETUP-SYNC.md)** (deploy a free Vercel function once).

## Watercolor map tiles (optional, free)
Out of the box the map uses OpenStreetMap tiles with a warm hand-drawn filter (no
key needed). For the *true* Stamen watercolor look, click **🎨 Watercolor tiles…**
on the Map and paste a free [Stadia Maps API key](https://client.stadiamaps.com/signup/)
(no credit card on the free tier). The key is stored locally in your browser.

## Tech
React + TypeScript + Vite · Leaflet · @dnd-kit · Zustand + Dexie (IndexedDB) ·
Framer Motion · vite-plugin-pwa. Handwritten fonts: Caveat, Patrick Hand, Gochi Hand.

## Project map
```
src/
  types.ts                 data model
  store/                   db (Dexie), tripStore (Zustand), seed (US Open)
  services/                geocode (Nominatim), placeInfo (Wikipedia), stickers
  components/              Sticker, PlaceCard, SearchAddPanel, RouteOverlay, dnd
  views/                   JournalView, WishlistView, MapView, TodayView
  utils/                   dates, settings
```
