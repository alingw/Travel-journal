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

async function callImage(payload: Record<string, unknown>): Promise<string> {
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
  return data.dataUrl as string
}

export function aiSticker(photoDataUrl: string): Promise<string> {
  return callImage({ mode: 'sticker', image: photoDataUrl })
}

export function aiBackground(context: BgContext): Promise<string> {
  return callImage({ mode: 'background', context })
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
