// Local mock of the /api/trips serverless function — for testing cloud sync
// WITHOUT GitHub. Stores trips in memory. Run:  node dev/mock-sync-server.mjs
// Then set the app's "Sync service URL" to http://localhost:8787
import http from 'node:http'
import crypto from 'node:crypto'

const PORT = 8787
const OWNER_KEY = 'test-owner'
const store = new Map() // tripId -> { name, salt, codeHash, trip, places, sha }

const hash = (code, salt) => crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex')
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
      const { action } = b
      const owner = (k) => k === OWNER_KEY
      if (action === 'open') {
        const f = store.get(b.tripId)
        if (!f) return send(res, 404, { ok: false, error: 'not found' })
        if (f.codeHash !== hash(b.code, f.salt)) return send(res, 403, { ok: false, error: 'wrong code' })
        return send(res, 200, { ok: true, name: f.name, trip: f.trip, places: f.places, sha: f.sha })
      }
      if (action === 'save') {
        const f = store.get(b.tripId)
        if (!f) return send(res, 404, { ok: false, error: 'not found' })
        if (f.codeHash !== hash(b.code, f.salt)) return send(res, 403, { ok: false, error: 'wrong code' })
        if (b.sha && b.sha !== f.sha)
          return send(res, 409, { ok: false, error: 'conflict', latest: { trip: f.trip, places: f.places, sha: f.sha } })
        f.trip = b.trip
        f.places = b.places
        f.sha = newSha()
        return send(res, 200, { ok: true, sha: f.sha })
      }
      if (action === 'create') {
        if (!owner(b.ownerKey)) return send(res, 403, { ok: false, error: 'owner only' })
        if (store.has(b.tripId)) return send(res, 409, { ok: false, error: 'already exists' })
        const salt = crypto.randomBytes(8).toString('hex')
        const sha = newSha()
        store.set(b.tripId, { name: b.trip?.name ?? b.tripId, salt, codeHash: hash(b.code, salt), trip: b.trip, places: b.places ?? [], sha })
        return send(res, 200, { ok: true, sha })
      }
      if (action === 'list') {
        if (!owner(b.ownerKey)) return send(res, 403, { ok: false, error: 'owner only' })
        return send(res, 200, { ok: true, trips: [...store.keys()] })
      }
      if (action === 'setcode') {
        if (!owner(b.ownerKey)) return send(res, 403, { ok: false, error: 'owner only' })
        const f = store.get(b.tripId)
        if (!f) return send(res, 404, { ok: false, error: 'not found' })
        f.salt = crypto.randomBytes(8).toString('hex')
        f.codeHash = hash(b.code, f.salt)
        return send(res, 200, { ok: true })
      }
      return send(res, 400, { ok: false, error: 'unknown action' })
    })
  })
  .listen(PORT, () => console.log(`mock sync server on http://localhost:${PORT} (owner key: ${OWNER_KEY})`))
