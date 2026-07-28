// Serverless API (Vercel Node function) — the ONLY thing allowed to read/write the
// private trip-data repo on GitHub. Access is gated by:
//   • a per-trip 4-digit CODE  → open + save a trip
//   • an OWNER_KEY secret       → create / list / rotate-code / delete
//
// Trip data lives at `trips/<tripId>.json` in the DATA_REPO. Each file stores a
// salted SHA-256 hash of the code (never the code itself).
//
// Required environment variables (set in Vercel project settings):
//   GITHUB_TOKEN  fine-grained PAT with Contents:read+write on the data repo only
//   DATA_REPO     "owner/repo" of the PRIVATE data repo (e.g. "you/travel-data")
//   OWNER_KEY     a long random secret only you know (admin actions)
//   ALLOW_ORIGIN  (optional) your app origin for CORS; defaults to "*"

import crypto from 'node:crypto'

const GH = 'https://api.github.com'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function hashCode(code: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex')
}

// Constant-time-ish compare on the hex hashes.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

function validId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{1,60}$/i.test(id)
}
function validCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{4}$/.test(code)
}

async function gh(path: string, init?: RequestInit) {
  const res = await fetch(`${GH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'travel-journal-sync',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  })
  return res
}

const filePath = (id: string) => `trips/${id}.json`

// Read a trip file → its parsed JSON + git blob sha (or null if missing).
async function readFile(id: string): Promise<{ data: any; sha: string } | null> {
  const res = await gh(`/repos/${env('DATA_REPO')}/contents/${filePath(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`)
  const json = await res.json()
  const content = Buffer.from(json.content, 'base64').toString('utf8')
  return { data: JSON.parse(content), sha: json.sha }
}

async function writeFile(id: string, data: any, sha: string | undefined, message: string) {
  const body: any = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
  }
  if (sha) body.sha = sha
  const res = await gh(`/repos/${env('DATA_REPO')}/contents/${filePath(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    const err: any = new Error(`GitHub write failed (${res.status})`)
    err.status = res.status
    err.detail = t
    throw err
  }
  const json = await res.json()
  return json.content.sha as string
}

export default async function handler(req: any, res: any) {
  const origin = process.env.ALLOW_ORIGIN || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ ok: false, error: 'bad json' })
    }
  }
  const { action } = body || {}

  try {
    const ownerOk = (k: unknown) => typeof k === 'string' && safeEqual(k, env('OWNER_KEY'))

    switch (action) {
      // ---- open: view/edit a trip with its 4-digit code ----
      case 'open': {
        const { tripId, code } = body
        if (!validId(tripId) || !validCode(code))
          return res.status(400).json({ ok: false, error: 'bad params' })
        const file = await readFile(tripId)
        if (!file) return res.status(404).json({ ok: false, error: 'not found' })
        if (!safeEqual(file.data.codeHash, hashCode(code, file.data.salt)))
          return res.status(403).json({ ok: false, error: 'wrong code' })
        return res.status(200).json({
          ok: true,
          name: file.data.name,
          trip: file.data.trip,
          places: file.data.places,
          sha: file.sha,
        })
      }

      // ---- save: commit edits (needs the code) with optimistic concurrency ----
      case 'save': {
        const { tripId, code, trip, places, sha } = body
        if (!validId(tripId) || !validCode(code) || !trip || !Array.isArray(places))
          return res.status(400).json({ ok: false, error: 'bad params' })
        const file = await readFile(tripId)
        if (!file) return res.status(404).json({ ok: false, error: 'not found' })
        if (!safeEqual(file.data.codeHash, hashCode(code, file.data.salt)))
          return res.status(403).json({ ok: false, error: 'wrong code' })
        // Someone else saved since this client last synced → tell it to reconcile.
        if (sha && sha !== file.sha)
          return res.status(409).json({
            ok: false,
            error: 'conflict',
            latest: { trip: file.data.trip, places: file.data.places, sha: file.sha },
          })
        const next = { ...file.data, trip, places }
        const newSha = await writeFile(tripId, next, file.sha, `Update ${tripId}`)
        return res.status(200).json({ ok: true, sha: newSha })
      }

      // ---- create: owner publishes a new trip + assigns its code ----
      case 'create': {
        const { ownerKey, tripId, code, trip, places } = body
        if (!ownerOk(ownerKey)) return res.status(403).json({ ok: false, error: 'owner only' })
        if (!validId(tripId) || !validCode(code) || !trip)
          return res.status(400).json({ ok: false, error: 'bad params' })
        const existing = await readFile(tripId)
        if (existing) return res.status(409).json({ ok: false, error: 'already exists' })
        const salt = crypto.randomBytes(8).toString('hex')
        const data = {
          v: 1,
          name: trip.name ?? tripId,
          salt,
          codeHash: hashCode(code, salt),
          trip,
          places: places ?? [],
        }
        const newSha = await writeFile(tripId, data, undefined, `Create ${tripId}`)
        return res.status(200).json({ ok: true, sha: newSha })
      }

      // ---- list: owner lists published trip ids ----
      case 'list': {
        const { ownerKey } = body
        if (!ownerOk(ownerKey)) return res.status(403).json({ ok: false, error: 'owner only' })
        const r = await gh(`/repos/${env('DATA_REPO')}/contents/trips`)
        if (r.status === 404) return res.status(200).json({ ok: true, trips: [] })
        if (!r.ok) throw new Error(`list failed (${r.status})`)
        const arr = await r.json()
        const trips = (arr as any[])
          .filter((f) => f.name.endsWith('.json'))
          .map((f) => f.name.replace(/\.json$/, ''))
        return res.status(200).json({ ok: true, trips })
      }

      // ---- setcode: owner rotates a trip's 4-digit code ----
      case 'setcode': {
        const { ownerKey, tripId, code } = body
        if (!ownerOk(ownerKey)) return res.status(403).json({ ok: false, error: 'owner only' })
        if (!validId(tripId) || !validCode(code))
          return res.status(400).json({ ok: false, error: 'bad params' })
        const file = await readFile(tripId)
        if (!file) return res.status(404).json({ ok: false, error: 'not found' })
        const salt = crypto.randomBytes(8).toString('hex')
        const next = { ...file.data, salt, codeHash: hashCode(code, salt) }
        await writeFile(tripId, next, file.sha, `Rotate code ${tripId}`)
        return res.status(200).json({ ok: true })
      }

      default:
        return res.status(400).json({ ok: false, error: 'unknown action' })
    }
  } catch (e: any) {
    if (e?.status === 409)
      return res.status(409).json({ ok: false, error: 'conflict (retry)' })
    return res.status(500).json({ ok: false, error: e?.message ?? 'server error' })
  }
}
