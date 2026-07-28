# Travel Journal Planner 🧳🎨

A hand-drawn **travel journal & planner** PWA. Plan where to go and where to eat,
pin "maybe" places, and see the whole trip on an animated watercolor map — with
sticker pins, handwritten notes, and drag-to-schedule. Ships seeded with a
**US Open 2026 (New York, Aug 23–27)** example trip.

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

## ⚠️ Important: don't run this directly from Google Drive
Google Drive's virtual filesystem (`G:\My Drive\…`) can't reliably hold
`node_modules` (npm install fails with `EBADF` / tar errors) and can't host the
dev server. **Keep the source here for backup/sync, but run from a local copy.**

### First-time setup (local working copy)
```bash
# 1) Copy the source to a local disk (excludes node_modules)
robocopy "G:\My Drive\CC\TravelApp" "C:\Users\<you>\TravelApp-dev" /E /XD node_modules .git dist

# 2) Install + run there
cd C:\Users\<you>\TravelApp-dev
npm install
npm run dev        # open http://localhost:5173
```

When you change code in the Drive copy, re-run the `robocopy` line to sync it to
the local copy before `npm run dev`. (Or just work in the local copy and robocopy
back to Drive to keep the backup current.)

### Build for production
```bash
npm run build      # outputs dist/  (installable PWA)
npm run preview
```

## Watercolor map tiles (optional, free)
Out of the box the map uses OpenStreetMap tiles with a warm hand-drawn filter (no
key needed). For the *true* Stamen watercolor look, click **🎨 Watercolor tiles…**
on the Map and paste a free [Stadia Maps API key](https://client.stadiamaps.com/signup/)
(no credit card on the free tier). The key is stored locally in your browser.

## Roadmap — AI stickers (later)
Stickers are a curated watercolor set today (`src/services/stickers.ts`), resolved
by keyword/category. Live AI generation is designed as a drop-in: implement the
`StickerProvider` interface against an image-gen API (OpenAI / Google / Replicate),
cache results, and toggle it in settings. No view changes required.

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
