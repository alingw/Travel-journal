// Sticker + background generation for the day journal.
//   • AI path  → the /api/image serverless function (OpenAI gpt-image-1)
//   • fallback → a fully client-side "die-cut" sticker + built-in paper textures,
//                so the journal works before an image key is set (or if the cap
//                is hit / the request fails).

import { getCloudApi } from './cloud'

export interface BgContext {
  city?: string
  date?: string
  places?: string[]
}

async function callImage(payload: Record<string, unknown>): Promise<string[]> {
  const res = await fetch(`${getCloudApi()}/api/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
  if (!res.ok || data.ok === false) {
    const err: any = new Error(data.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  // New shape returns dataUrls[]; tolerate the old single dataUrl too.
  const urls: string[] = data.dataUrls || (data.dataUrl ? [data.dataUrl] : [])
  if (!urls.length) throw new Error('no image returned')
  return urls
}

// Generate a sticker set from one photo: a single transparent sheet (one API call,
// avoiding per-image rate limits) segmented into individual die-cut stickers here.
export async function aiStickers(photoDataUrl: string): Promise<string[]> {
  const urls = await callImage({ mode: 'sticker', image: photoDataUrl })
  const sheet = urls[0]
  const tiles = await segmentSheet(sheet, 6)
  return tiles.length ? tiles : [await downscale(sheet, 420, 'image/png')]
}

// Split a transparent sticker sheet into individual stickers by finding the
// opaque connected regions (each die-cut sticker is one blob), cropping each to a
// padded bounding box. Robust to imperfect grid placement.
export async function segmentSheet(sheetDataUrl: string, maxOut = 6, outMax = 420): Promise<string[]> {
  const img = await loadImage(sheetDataUrl)
  const w = img.width
  const h = img.height
  const src = document.createElement('canvas')
  src.width = w
  src.height = h
  const sctx = src.getContext('2d')!
  sctx.drawImage(img, 0, 0)
  const alpha = sctx.getImageData(0, 0, w, h).data

  const ALPHA = 24
  const opaque = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) opaque[i] = alpha[i * 4 + 3] > ALPHA ? 1 : 0

  // Flood-fill label the opaque connected components (4-neighbour).
  const label = new Int32Array(w * h)
  const stack: number[] = []
  const comps: { minX: number; minY: number; maxX: number; maxY: number; area: number }[] = []
  let cur = 0
  for (let i = 0; i < w * h; i++) {
    if (!opaque[i] || label[i]) continue
    cur++
    let minX = w, minY = h, maxX = 0, maxY = 0, area = 0
    stack.push(i)
    label[i] = cur
    while (stack.length) {
      const p = stack.pop()!
      const x = p % w
      const y = (p - x) / w
      area++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && opaque[p - 1] && !label[p - 1]) (label[p - 1] = cur), stack.push(p - 1)
      if (x < w - 1 && opaque[p + 1] && !label[p + 1]) (label[p + 1] = cur), stack.push(p + 1)
      if (y > 0 && opaque[p - w] && !label[p - w]) (label[p - w] = cur), stack.push(p - w)
      if (y < h - 1 && opaque[p + w] && !label[p + w]) (label[p + w] = cur), stack.push(p + w)
    }
    comps.push({ minX, minY, maxX, maxY, area })
  }

  // Keep the significant blobs (ignore tiny specks), biggest first, then order by
  // position (row-major) so the stickers read left-to-right, top-to-bottom.
  const minArea = w * h * 0.004
  const sig = comps
    .filter((k) => k.area >= minArea)
    .sort((a, b) => b.area - a.area)
    .slice(0, maxOut)
    .sort((a, b) => a.minY - b.minY || a.minX - b.minX)

  const tiles: string[] = []
  for (const k of sig) {
    const span = Math.max(k.maxX - k.minX, k.maxY - k.minY)
    const pad = Math.round(span * 0.06)
    const x0 = Math.max(0, k.minX - pad)
    const y0 = Math.max(0, k.minY - pad)
    const x1 = Math.min(w - 1, k.maxX + pad)
    const y1 = Math.min(h - 1, k.maxY + pad)
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    const scale = Math.min(1, outMax / Math.max(bw, bh))
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(bw * scale))
    out.height = Math.max(1, Math.round(bh * scale))
    out.getContext('2d')!.drawImage(src, x0, y0, bw, bh, 0, 0, out.width, out.height)
    tiles.push(out.toDataURL('image/png'))
  }
  return tiles
}

export async function aiBackground(context: BgContext): Promise<string> {
  const urls = await callImage({ mode: 'background', context })
  return urls[0]
}

// ---------- image helpers (all client-side) ----------

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('could not read file'))
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('could not load image'))
    img.src = src
  })
}

// Shrink a data URL so it's cheap to store/upload. Keeps aspect ratio.
export async function downscale(
  dataUrl: string,
  maxSide: number,
  mime: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.85,
): Promise<string> {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  return c.toDataURL(mime, quality)
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Fallback "sticker": cover-fit the photo into a squircle with a warm-white
// die-cut border, transparent outside. Returns a PNG data URL.
export async function cutoutSticker(photoDataUrl: string, size = 360): Promise<string> {
  const img = await loadImage(photoDataUrl)
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const border = Math.round(size * 0.055)
  const radius = Math.round(size * 0.2)

  // Warm-white die-cut backing (the visible border).
  ctx.fillStyle = '#fbf7ee'
  roundedRect(ctx, 0, 0, size, size, radius)
  ctx.fill()

  // Clip to the inner rounded rect and draw the photo cover-fit inside.
  ctx.save()
  const inner = size - border * 2
  roundedRect(ctx, border, border, inner, inner, Math.max(2, radius - border))
  ctx.clip()
  const s = Math.max(inner / img.width, inner / img.height)
  const dw = img.width * s
  const dh = img.height * s
  ctx.drawImage(img, border + (inner - dw) / 2, border + (inner - dh) / 2, dw, dh)
  ctx.restore()

  return c.toDataURL('image/png')
}

// ---------- built-in paper backgrounds (no key needed) ----------

export interface PaperBg {
  id: string
  label: string
  css: string // a CSS background value
}

export const PAPERS: PaperBg[] = [
  { id: 'cream', label: 'Cream', css: '#f4efe4' },
  {
    id: 'kraft',
    label: 'Kraft',
    css: 'linear-gradient(160deg, #d9c3a3, #cdb58f)',
  },
  {
    id: 'grid',
    label: 'Grid',
    css: 'repeating-linear-gradient(#f4efe4, #f4efe4 23px, #e2dccc 24px), repeating-linear-gradient(90deg, #f4efe4, #f4efe4 23px, #e2dccc 24px)',
  },
  {
    id: 'dots',
    label: 'Dots',
    css: 'radial-gradient(#cfc7b4 1.4px, transparent 1.6px) 0 0 / 18px 18px, #f4efe4',
  },
  {
    id: 'linen',
    label: 'Linen',
    css: 'repeating-linear-gradient(45deg, #efe9dc, #efe9dc 3px, #e8e1d1 3px, #e8e1d1 6px)',
  },
  {
    id: 'sky',
    label: 'Sky wash',
    css: 'linear-gradient(180deg, #dfe9ee, #eef0e6 60%, #f2ece0)',
  },
]

export function paperCss(id: string): string {
  return PAPERS.find((p) => p.id === id)?.css ?? PAPERS[0].css
}

// A background value is either a stored image (data URL) or a "paper:<id>" token.
export function backgroundStyle(bg?: string): string {
  if (!bg) return paperCss('cream')
  if (bg.startsWith('paper:')) return paperCss(bg.slice(6))
  return `url("${bg}") center / cover no-repeat`
}
