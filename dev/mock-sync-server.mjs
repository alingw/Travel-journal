// Local mock of /api/trips (code-keyed model) — test cloud sync WITHOUT GitHub.
// Run:  node dev/mock-sync-server.mjs
// Then in the app's landing → advanced, set Sync URL to http://localhost:8787
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'

const PORT = 8787
const OWNER_KEY = 'test-owner'
const store = new Map() // code (or legacy name) -> { name, trip, places, sha, legacy? }
const newSha = () => crypto.randomBytes(8).toString('hex')
const hashCode = (code, salt) => crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex')
const MOCK_SUGGEST_LIMIT = 3 // for testing the daily-cap 429 path
let mockSuggestCount = 0

// Pre-seed one OLD-format trip (name-keyed, hashed code) to test migration on open.
;(() => {
  const salt = 'testsalt'
  store.set('legacy-us-open', {
    legacy: true,
    name: 'Legacy US Open',
    salt,
    codeHash: hashCode('7777', salt),
    trip: { id: 'legacy-us-open', name: 'Legacy US Open', baseCity: 'New York', startDate: '2026-08-23', endDate: '2026-08-27' },
    places: [
      { id: 'lg1', tripId: 'legacy-us-open', name: 'Legacy Stop', category: 'sight', status: 'wishlist', stickerId: 'landmark' },
    ],
    sha: newSha(),
  })
})()

function send(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  })
  res.end(JSON.stringify(obj))
}

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {})
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let b = {}
      try {
        b = JSON.parse(body || '{}')
      } catch {
        return send(res, 400, { ok: false, error: 'bad json' })
      }
      // Canned image generation (no real model) so the journal flow can be tested.
      // Returns ONE image (a sticker sheet or background); the client segments the
      // sheet into individual stickers. Drop a real transparent sheet data-URL in
      // dev/test-sheet.txt to exercise segmentation; otherwise a 1x1 placeholder.
      if ((req.url || '').includes('/api/image')) {
        const px =
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        if (b.mode === 'background') return send(res, 200, { ok: true, dataUrls: [px] })
        let sheet = px
        try {
          sheet = fs.readFileSync(new URL('./test-sheet.txt', import.meta.url), 'utf8').trim() || px
        } catch {
          /* no test sheet present */
        }
        return send(res, 200, { ok: true, dataUrls: [sheet] })
      }
      // Canned AI suggestion (no real LLM) so the client flow can be tested.
      if ((req.url || '').includes('/api/suggest')) {
        mockSuggestCount++
        if (mockSuggestCount > MOCK_SUGGEST_LIMIT)
          return send(res, 429, { ok: false, error: `Daily AI limit reached (${MOCK_SUGGEST_LIMIT} per day). It resets at UTC midnight.` })
        const days = b.days || []
        const assignments = (b.places || []).map((p, i) => ({
          placeId: p.id,
          dayDate: days[i % Math.max(1, days.length)] || days[0],
          order: Math.floor(i / Math.max(1, days.length)),
          startTime: p.category === 'food' ? '12:30' : p.category === 'event' ? '19:00' : '',
        }))
        return send(res, 200, {
          ok: true,
          reasoning: 'Mock plan: spread places across days, meals at noon, events in the evening.',
          assignments,
        })
      }
      const owner = (k) => k === OWNER_KEY
      if (b.action === 'open') {
        const direct = store.get(b.code)
        if (direct && !direct.legacy)
          return send(res, 200, { ok: true, name: direct.name, trip: direct.trip, places: direct.places, sha: direct.sha })
        // Backward-compat: find + migrate an old-format trip by its code.
        for (const [key, v] of store) {
          if (v.legacy && v.salt && hashCode(b.code, v.salt) === v.codeHash) {
            const migrated = { name: v.name, trip: v.trip, places: v.places, sha: newSha() }
            store.delete(key)
            store.set(b.code, migrated)
            return send(res, 200, { ok: true, ...migrated })
          }
        }
        return send(res, 404, { ok: false, error: 'no trip with that code' })
      }
      if (b.action === 'save') {
        const f = store.get(b.code)
        if (!f) return send(res, 404, { ok: false, error: 'not found' })
        if (b.sha && b.sha !== f.sha)
          return send(res, 409, { ok: false, error: 'conflict', latest: { trip: f.trip, places: f.places, sha: f.sha } })
        f.trip = b.trip
        f.places = b.places
        f.name = b.trip?.name ?? f.name
        f.sha = newSha()
        return send(res, 200, { ok: true, sha: f.sha })
      }
      if (b.action === 'create') {
        if (!owner(b.ownerKey)) return send(res, 403, { ok: false, error: 'owner only' })
        if (store.has(b.code)) return send(res, 409, { ok: false, error: 'code already in use' })
        const sha = newSha()
        store.set(b.code, { name: b.trip?.name ?? b.code, trip: b.trip, places: b.places ?? [], sha })
        return send(res, 200, { ok: true, sha })
      }
      if (b.action === 'list') {
        if (!owner(b.ownerKey)) return send(res, 403, { ok: false, error: 'owner only' })
        return send(res, 200, { ok: true, trips: [...store.keys()] })
      }
      return send(res, 400, { ok: false, error: 'unknown action' })
    })
  })
  .listen(PORT, () => console.log(`mock sync server on http://localhost:${PORT} (owner key: ${OWNER_KEY})`))
