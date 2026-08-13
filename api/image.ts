// Serverless image endpoint: turns a photo into a die-cut travel sticker, or
// generates a scrapbook background for a day — via OpenAI's gpt-image-1.
//
// Implements the art direction from the "travel memory card" skill: opaque
// gouache / cut-paper / risograph fills, matte colours, blunt shapes, a warm-white
// die-cut border, one clear scene anchor, transparent background for stickers.
//
// Required environment variable (set in Vercel project settings):
//   OPENAI_API_KEY   your OpenAI key (org must be verified for gpt-image-1)
// Optional:
//   IMAGE_DAILY_LIMIT   max generations/day (default 20; 0 disables the cap)
//
// The cap reuses the same GitHub counter trick as /api/suggest, so it needs the
// GITHUB_TOKEN + DATA_REPO you already have; without them it simply doesn't cap.

const OPENAI = 'https://api.openai.com/v1/images'
const MODEL = 'gpt-image-1'
const GH = 'https://api.github.com'

const STICKER_PROMPT = `Create a sticker SHEET of SIX different die-cut travel
stickers based on this photo, arranged in a clean grid of 3 columns and 2 rows.
Space them out with generous empty margins so no two stickers touch or overlap —
one distinct sticker per cell. Each sticker: opaque gouache / cut-paper / risograph
style, matte colour families, blunt simple shapes, paper-tooth texture, a thick
warm-white die-cut border, showing a different element, subject or view from the
scene. Every sticker is fully opaque; EVERYTHING outside the die-cut stickers
(including all the space between them) must be fully transparent. No photorealism,
no detailed faces or anatomy, and absolutely no text or lettering.`

function backgroundPrompt(ctx: { city?: string; date?: string; places?: string[] }): string {
  const places = (ctx.places || []).filter(Boolean).slice(0, 6).join(', ')
  return `A hand-crafted travel-journal page BACKGROUND for a day${
    ctx.city ? ` in ${ctx.city}` : ''
  }${ctx.date ? ` (${ctx.date})` : ''}. Soft gouache and cut-paper collage${
    places ? ` gently evoking: ${places}` : ''
  }. Muted warm paper tones, faint map lines, small washi-tape / postage-stamp
  accents around the EDGES only, and a large calm open area through the middle for
  photos and notes. Flat, matte, scrapbook aesthetic. No text, no words, no
  lettering, no captions anywhere.`
}

// ---- daily usage cap (counter file in the private data repo) ----
function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'travel-journal-image',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}
async function ghGet(repo: string, token: string, path: string) {
  const res = await fetch(`${GH}/repos/${repo}/contents/${path}`, { headers: ghHeaders(token) })
  if (!res.ok) return null
  const j = await res.json()
  try {
    return { data: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')), sha: j.sha as string }
  } catch {
    return { data: {}, sha: j.sha as string }
  }
}
async function ghPut(repo: string, token: string, path: string, obj: any, sha?: string) {
  const body: any = { message: 'image usage', content: Buffer.from(JSON.stringify(obj)).toString('base64') }
  if (sha) body.sha = sha
  const res = await fetch(`${GH}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  })
  return { ok: res.ok, status: res.status }
}
// Reserves `cost` images against today's cap (each generated image counts).
async function withinDailyLimit(limit: number, cost: number): Promise<boolean> {
  const repo = process.env.DATA_REPO
  const token = process.env.GITHUB_TOKEN
  if (!repo || !token || !(limit > 0)) return true
  const date = new Date().toISOString().slice(0, 10)
  const path = `usage/image-${date}.json`
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await ghGet(repo, token, path)
    const count: number = cur?.data?.count ?? 0
    if (count + cost > limit) return false
    const put = await ghPut(repo, token, path, { date, count: count + cost }, cur?.sha)
    if (put.ok || put.status !== 409) return true
  }
  return true
}

function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '')
  if (!m) throw new Error('bad image data')
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

  const key = process.env.OPENAI_API_KEY
  if (!key) return res.status(500).json({ ok: false, error: 'OPENAI_API_KEY not set' })

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ ok: false, error: 'bad json' })
    }
  }
  const { mode } = body || {}
  if (mode !== 'sticker' && mode !== 'background')
    return res.status(400).json({ ok: false, error: 'mode must be "sticker" or "background"' })
  if (mode === 'sticker' && !body.image)
    return res.status(400).json({ ok: false, error: 'sticker mode needs an image' })

  // One image per call (a sticker sheet or a background) — sliced client-side.
  const limit = parseInt(process.env.IMAGE_DAILY_LIMIT || '40', 10)
  if (!(await withinDailyLimit(limit, 1)))
    return res.status(429).json({
      ok: false,
      error: `Daily image limit reached (${limit} per day). It resets at UTC midnight.`,
    })

  try {
    if (mode === 'sticker') {
      const { image } = body
      const { buf, mime } = dataUrlToBuffer(image)
      const form = new FormData()
      form.append('model', MODEL)
      form.append('prompt', STICKER_PROMPT)
      form.append('image', new Blob([buf], { type: mime || 'image/png' }), 'photo.png')
      form.append('size', '1536x1024') // landscape sheet → ~square 3×2 cells
      form.append('background', 'transparent')
      form.append('output_format', 'png')
      form.append('quality', body.quality || 'medium')
      form.append('n', '1')
      const r = await fetch(`${OPENAI}/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      })
      const data = await r.json()
      if (!r.ok) {
        return res.status(502).json({ ok: false, error: data?.error?.message || `OpenAI ${r.status}` })
      }
      const urls = (data?.data || [])
        .map((d: any) => d?.b64_json)
        .filter(Boolean)
        .map((b: string) => `data:image/png;base64,${b}`)
      if (!urls.length) return res.status(502).json({ ok: false, error: 'no image returned' })
      return res.status(200).json({ ok: true, dataUrls: urls })
    }

    // background
    const ctx = body.context || {}
    const r = await fetch(`${OPENAI}/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: backgroundPrompt(ctx),
        size: '1536x1024',
        output_format: 'jpeg',
        output_compression: 80,
        quality: body.quality || 'medium',
        n: 1,
      }),
    })
    const data = await r.json()
    if (!r.ok) {
      return res.status(502).json({ ok: false, error: data?.error?.message || `OpenAI ${r.status}` })
    }
    const b64 = data?.data?.[0]?.b64_json
    if (!b64) return res.status(502).json({ ok: false, error: 'no image returned' })
    return res.status(200).json({ ok: true, dataUrls: [`data:image/jpeg;base64,${b64}`] })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'image generation failed' })
  }
}
