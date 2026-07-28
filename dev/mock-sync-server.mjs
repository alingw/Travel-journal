// Local mock of /api/trips (code-keyed model) — test cloud sync WITHOUT GitHub.
// Run:  node dev/mock-sync-server.mjs
// Then in the app's landing → advanced, set Sync URL to http://localhost:8787
import http from 'node:http'
import crypto from 'node:crypto'

const PORT = 8787
const OWNER_KEY = 'test-owner'
const store = new Map() // code -> { name, trip, places, sha }
const newSha = () => crypto.randomBytes(8).toString('hex')

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
      const owner = (k) => k === OWNER_KEY
      if (b.action === 'open') {
        const f = store.get(b.code)
        if (!f) return send(res, 404, { ok: false, error: 'no trip with that code' })
        return send(res, 200, { ok: true, name: f.name, trip: f.trip, places: f.places, sha: f.sha })
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
