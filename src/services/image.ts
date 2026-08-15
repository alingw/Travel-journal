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

// One API call → one sticker sheet (raw, un-segmented). Kept separate so callers
// (and the debug view) can inspect exactly what the model returned.
export async function aiStickerSheet(photoDataUrl: string): Promise<string> {
  const urls = await callImage({ mode: 'sticker', image: photoDataUrl })
  return urls[0]
}

// Generate a sticker set from one photo: one sheet, segmented into stickers here.
export async function aiStickers(photoDataUrl: string): Promise<string[]> {
  const sheet = await aiStickerSheet(photoDataUrl)
  const { tiles } = await segmentWithInfo(sheet)
  return tiles.length ? tiles : [await downscale(sheet, 420, 'image/png')]
}

export interface SegInfo {
  w: number
  h: number
  corner: { r: number; g: number; b: number }
  greenPct: number // % of pixels classified as green screen
  blobs: number // significant connected components found
  kept: number // stickers returned
  method: 'chroma' | 'grid'
}

const isGreenPx = (r: number, g: number, b: number) => g > 90 && g - r > 45 && g - b > 45

// Backward-compatible: return just the tiles.
export async function segmentSheet(sheetDataUrl: string, outMax = 420): Promise<string[]> {
  const { tiles } = await segmentWithInfo(sheetDataUrl, outMax)
  return tiles
}

// Split a sticker sheet into six individual stickers — deterministically.
// The model reliably lays the stickers out in a 3×2 grid, so we slice that grid
// first (always six), then remove each CELL's background with a small, BOUNDED
// per-cell flood-fill from the cell edges (no expensive whole-sheet pass). Green
// screens key wide (clean die-cut); a plain/cream background keys tight so the
// white borders survive. Every cell falls back to its full square if keying would
// erase it, so you always get six separate, handleable stickers.
export async function segmentWithInfo(
  sheetDataUrl: string,
  outMax = 420,
  cols = 3,
  rows = 2,
): Promise<{ tiles: string[]; info: SegInfo }> {
  const img = await loadImage(sheetDataUrl)
  const W = img.width
  const H = img.height
  const cw = Math.max(1, Math.floor(W / cols))
  const ch = Math.max(1, Math.floor(H / rows))

  let cornerSample = { r: 0, g: 0, b: 0 }
  let greenPixels = 0
  const cellArea = cw * ch
  const tiles: string[] = []

  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const cell = document.createElement('canvas')
      cell.width = cw
      cell.height = ch
      const ctx = cell.getContext('2d')!
      ctx.drawImage(img, cx * cw, ry * ch, cw, ch, 0, 0, cw, ch)
      const idata = ctx.getImageData(0, 0, cw, ch)
      const d = idata.data
      const N = cw * ch

      // Background = average of this cell's four corners.
      const cIdx = [0, cw - 1, (ch - 1) * cw, N - 1]
      let br = 0, bg = 0, bb = 0
      for (const p of cIdx) {
        br += d[p * 4]
        bg += d[p * 4 + 1]
        bb += d[p * 4 + 2]
      }
      const bR = br / 4, bG = bg / 4, bB = bb / 4
      const green = isGreenPx(bR, bG, bB)
      if (ry === 0 && cx === 0) cornerSample = { r: Math.round(bR), g: Math.round(bG), b: Math.round(bB) }
      const TH = green ? 120 : 12 // colour distance to treat a pixel as background

      const isBg = (i: number) => {
        if (d[i * 4 + 3] < 12) return true
        const dr = d[i * 4] - bR, dg = d[i * 4 + 1] - bG, db = d[i * 4 + 2] - bB
        return dr * dr + dg * dg + db * db < TH * TH
      }

      // Flood-fill the EXTERIOR background inward from the cell edges (bounded to
      // this cell), so background enclosed inside a sticker is left intact.
      const ext = new Uint8Array(N)
      const stack: number[] = []
      const seed = (x: number, y: number) => {
        const i = y * cw + x
        if (!ext[i] && isBg(i)) {
          ext[i] = 1
          stack.push(i)
        }
      }
      for (let x = 0; x < cw; x++) {
        seed(x, 0)
        seed(x, ch - 1)
      }
      for (let y = 0; y < ch; y++) {
        seed(0, y)
        seed(cw - 1, y)
      }
      while (stack.length) {
        const i = stack.pop()!
        const x = i % cw
        const y = (i - x) / cw
        if (x > 0) seed(x - 1, y)
        if (x < cw - 1) seed(x + 1, y)
        if (y > 0) seed(x, y - 1)
        if (y < ch - 1) seed(x, y + 1)
      }

      // Apply: exterior → transparent; despill green; measure kept bounds.
      let minX = cw, minY = ch, maxX = -1, maxY = -1
      for (let i = 0; i < N; i++) {
        if (isGreenPx(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])) greenPixels++
        if (ext[i]) {
          d[i * 4 + 3] = 0
          continue
        }
        if (green) {
          const cap = Math.max(d[i * 4], d[i * 4 + 2])
          if (d[i * 4 + 1] > cap) d[i * 4 + 1] = cap
        }
        const x = i % cw
        const y = (i - x) / cw
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }

      // If keying erased (almost) everything, keep the whole cell instead.
      if (maxX < minX || (maxX - minX) < cw * 0.15 || (maxY - minY) < ch * 0.15) {
        ctx.drawImage(img, cx * cw, ry * ch, cw, ch, 0, 0, cw, ch)
        minX = 0
        minY = 0
        maxX = cw - 1
        maxY = ch - 1
      } else {
        ctx.putImageData(idata, 0, 0)
      }

      const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.05)
      const x0 = Math.max(0, minX - pad)
      const y0 = Math.max(0, minY - pad)
      const x1 = Math.min(cw - 1, maxX + pad)
      const y1 = Math.min(ch - 1, maxY + pad)
      const bw = x1 - x0 + 1
      const bh = y1 - y0 + 1
      const scale = Math.min(1, outMax / Math.max(bw, bh))
      const out = document.createElement('canvas')
      out.width = Math.max(1, Math.round(bw * scale))
      out.height = Math.max(1, Math.round(bh * scale))
      out.getContext('2d')!.drawImage(cell, x0, y0, bw, bh, 0, 0, out.width, out.height)
      tiles.push(out.toDataURL('image/png'))
    }
  }

  const info: SegInfo = {
    w: W,
    h: H,
    corner: cornerSample,
    greenPct: Math.round((greenPixels / (cellArea * cols * rows)) * 100),
    blobs: tiles.length,
    kept: tiles.length,
    method: isGreenPx(cornerSample.r, cornerSample.g, cornerSample.b) ? 'chroma' : 'grid',
  }
  return { tiles, info }
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
