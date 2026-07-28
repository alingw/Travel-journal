// Serverless API (Vercel Node function) — the ONLY thing allowed to read/write the
// private trip-data repo on GitHub.
//
// Trips are keyed by their 4-digit CODE: each is stored at `trips/<code>.json` in
// the (private) DATA_REPO. Because the repo is private and only this function holds
// the token, knowing the code is what grants access:
//   • a 4-digit CODE  → open + save that trip
//   • an OWNER_KEY    → create a new trip / list codes  (owner-only)
//
// Required environment variables (set in Vercel project settings):
//   GITHUB_TOKEN  fine-grained PAT with Contents:read+write on the data repo only
//   DATA_REPO     "owner/repo" of the PRIVATE data repo (e.g. "you/travel-data")
//   OWNER_KEY     a long random secret only you know (create/list)
//   ALLOW_ORIGIN  (optional) your app origin for CORS; defaults to "*"

import crypto from 'node:crypto'

const GH = 'https://api.github.com'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

// Constant-time compare for the owner key.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

function validCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{4}$/.test(code)
}

// Only needed to recognise trips saved under the OLD format (name-keyed, with a
// salted code hash) so we can migrate them to the new code-keyed format on open.
function hashCode(code: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex')
}

async function gh(path: string, init?: RequestInit) {
  return fetch(`${GH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'travel-journal-sync',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  })
}

const filePath = (code: string) => `trips/${code}.json`

async function readFile(code: string): Promise<{ data: any; sha: string } | null> {
  const res = await gh(`/repos/${env('DATA_REPO')}/contents/${filePath(code)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`)
  const json = await res.json()
  const content = Buffer.from(json.content, 'base64').toString('utf8')
  return { data: JSON.parse(content), sha: json.sha }
}

async function writeFile(code: string, data: any, sha: string | undefined, message: string) {
  const body: any = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
  }
  if (sha) body.sha = sha
  const res = await gh(`/repos/${env('DATA_REPO')}/contents/${filePath(code)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err: any = new Error(`GitHub write failed (${res.status})`)
    err.status = res.status
    throw err
  }
  const json = await res.json()
  return json.content.sha as string
}

async function deleteFile(key: string, sha: string, message: string) {
  const res = await gh(`/repos/${env('DATA_REPO')}/contents/${filePath(key)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha }),
  })
  if (!res.ok && res.status !== 404) throw new Error(`GitHub delete failed (${res.status})`)
}

// Scan for a trip stored in the OLD name-keyed format whose salted codeHash
// matches `code`, so `open` can migrate it to the new code-keyed format.
async function findLegacyByCode(
  code: string,
): Promise<{ key: string; data: any; sha: string } | null> {
  const r = await gh(`/repos/${env('DATA_REPO')}/contents/trips`)
  if (!r.ok) return null
  const arr = (await r.json()) as any[]
  for (const f of arr) {
    if (!f.name?.endsWith('.json')) continue
    const key = f.name.replace(/\.json$/, '')
    if (key === code) continue
    const file = await readFile(key)
    if (
      file?.data?.codeHash &&
      file.data.salt &&
      hashCode(code, file.data.salt) === file.data.codeHash
    ) {
      return { key, data: file.data, sha: file.sha }
    }
  }
  return null
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*')
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
      // ---- open: load a trip by its 4-digit code ----
      case 'open': {
        const { code } = body
        if (!validCode(code)) return res.status(400).json({ ok: false, error: 'bad code' })
        const file = await readFile(code)
        if (!file) {
          // Backward-compat: migrate an old-format trip to the new code key on first open.
          const legacy = await findLegacyByCode(code)
          if (legacy) {
            const migrated = {
              v: 1,
              name: legacy.data.name ?? code,
              trip: legacy.data.trip,
              places: legacy.data.places ?? [],
            }
            const newSha = await writeFile(code, migrated, undefined, `Migrate ${legacy.key} -> ${code}`)
            await deleteFile(legacy.key, legacy.sha, `Remove legacy ${legacy.key}`).catch(() => {})
            return res.status(200).json({
              ok: true,
              name: migrated.name,
              trip: migrated.trip,
              places: migrated.places,
              sha: newSha,
            })
          }
          return res.status(404).json({ ok: false, error: 'no trip with that code' })
        }
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
        const { code, trip, places, sha } = body
        if (!validCode(code) || !trip || !Array.isArray(places))
          return res.status(400).json({ ok: false, error: 'bad params' })
        const file = await readFile(code)
        if (!file) return res.status(404).json({ ok: false, error: 'not found' })
        if (sha && sha !== file.sha)
          return res.status(409).json({
            ok: false,
            error: 'conflict',
            latest: { trip: file.data.trip, places: file.data.places, sha: file.sha },
          })
        const next = { ...file.data, name: trip.name ?? file.data.name, trip, places }
        const newSha = await writeFile(code, next, file.sha, `Update ${code}`)
        return res.status(200).json({ ok: true, sha: newSha })
      }

      // ---- create: owner makes a new trip under a chosen 4-digit code ----
      case 'create': {
        const { ownerKey, code, trip, places } = body
        if (!ownerOk(ownerKey)) return res.status(403).json({ ok: false, error: 'owner only' })
        if (!validCode(code) || !trip)
          return res.status(400).json({ ok: false, error: 'bad params' })
        const existing = await readFile(code)
        if (existing) return res.status(409).json({ ok: false, error: 'code already in use' })
        const data = { v: 1, name: trip.name ?? code, trip, places: places ?? [] }
        const newSha = await writeFile(code, data, undefined, `Create ${code}`)
        return res.status(200).json({ ok: true, sha: newSha })
      }

      // ---- list: owner lists existing trip codes + names ----
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

      default:
        return res.status(400).json({ ok: false, error: 'unknown action' })
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'server error' })
  }
}
