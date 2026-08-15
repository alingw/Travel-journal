import { useEffect, useMemo, useRef, useState } from 'react'
import { useJournal } from '../store/journalStore'
import { useAssets } from '../store/assetStore'
import type { JournalSticker } from '../types'
import {
  aiStickerSheet,
  segmentWithInfo,
  aiBackground,
  cutoutSticker,
  downscale,
  fileToDataUrl,
  backgroundStyle,
  PAPERS,
  type BgContext,
  type SegInfo,
} from '../services/image'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const BASE_WIDTH_PCT = 26 // a scale=1 sticker spans this % of the canvas width

// The scrapbook page for one day: a background plus photo-stickers you can drag,
// resize, rotate, toggle, and delete. Uploading a photo generates a set of stickers
// (AI when a key is set, otherwise a client-side die-cut cut-out) that are saved to
// a reusable per-trip library; tap any saved sticker/background to drop it on a day.
export function JournalCanvas({
  tripId,
  day,
  bgContext,
}: {
  tripId: string
  day: string
  bgContext: BgContext
}) {
  const load = useJournal((s) => s.load)
  const page = useJournal((s) => s.byKey[`${tripId}::${day}`])
  const addSticker = useJournal((s) => s.addSticker)
  const updateSticker = useJournal((s) => s.updateSticker)
  const removeSticker = useJournal((s) => s.removeSticker)
  const setBackground = useJournal((s) => s.setBackground)
  const setCaption = useJournal((s) => s.setCaption)

  const loadAssets = useAssets((s) => s.load)
  const addAssets = useAssets((s) => s.addMany)
  const removeAsset = useAssets((s) => s.remove)
  const lib = useAssets((s) => s.byTrip[tripId])
  const stickerLib = useMemo(() => (lib ?? []).filter((a) => a.kind === 'sticker'), [lib])
  const bgLib = useMemo(() => (lib ?? []).filter((a) => a.kind === 'background'), [lib])

  useEffect(() => {
    load(tripId, day)
    loadAssets(tripId)
  }, [tripId, day, load, loadAssets])

  const stickers = page?.stickers ?? []
  const visible = stickers.filter((s) => !s.hidden)
  const hidden = stickers.filter((s) => s.hidden)

  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [bgBusy, setBgBusy] = useState(false)
  const [note, setNote] = useState('')
  const [paperOpen, setPaperOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const [debug, setDebug] = useState<{ sheet: string; tiles: string[]; info: SegInfo } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const drag = useRef<{ id: string; px: number; py: number; x: number; y: number; w: number; h: number } | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)

  const sel = stickers.find((s) => s.id === selected && !s.hidden) || null

  // Upload a photo → generate a sticker set → save to the trip library.
  async function onPickPhoto(file: File) {
    setNote('')
    setAdding(true)
    try {
      const raw = await fileToDataUrl(file)
      const photo = await downscale(raw, 1024, 'image/jpeg', 0.9) // shrink before upload
      let srcs: string[]
      try {
        const sheet = await aiStickerSheet(photo)
        const { tiles, info } = await segmentWithInfo(sheet)
        srcs = tiles
        setDebug({ sheet, tiles, info })
        setNote(
          `Added ${srcs.length} stickers (${info.method}) — tap one to place it.` +
            (info.method === 'grid' ? ' Open Debug to see the raw sheet.' : ''),
        )
      } catch (e: any) {
        srcs = [await cutoutSticker(photo, 420)]
        setDebug(null)
        setNote(
          e?.status === 429
            ? 'Daily AI limit reached — saved a plain cut-out to your library instead.'
            : `AI stickers unavailable: ${e?.message || 'request failed'} — saved a plain cut-out instead.`,
        )
      }
      await addAssets(tripId, 'sticker', srcs)
    } catch (e: any) {
      setNote(e?.message ?? 'could not add that photo')
    } finally {
      setAdding(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function genBackground() {
    setNote('')
    setBgBusy(true)
    try {
      const ai = await aiBackground(bgContext)
      const small = await downscale(ai, 1280, 'image/jpeg', 0.82)
      const [asset] = await addAssets(tripId, 'background', [small])
      await setBackground(tripId, day, asset.src)
    } catch (e: any) {
      setNote(
        e?.status === 429
          ? 'Daily image limit reached — pick a paper background below.'
          : `AI background unavailable: ${e?.message || 'request failed'}. Pick a paper below.`,
      )
      setPaperOpen(true)
    } finally {
      setBgBusy(false)
    }
  }

  // ---- sticker dragging ----
  function onDown(e: React.PointerEvent, s: JournalSticker) {
    e.stopPropagation()
    setSelected(s.id)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    drag.current = { id: s.id, px: e.clientX, py: e.clientY, x: s.x, y: s.y, w: rect.width, h: rect.height }
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* capture optional */
    }
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const nx = clamp(d.x + (e.clientX - d.px) / d.w, 0, 1)
    const ny = clamp(d.y + (e.clientY - d.py) / d.h, 0, 1)
    setDragPos({ id: d.id, x: nx, y: ny })
  }
  function onUp() {
    const d = drag.current
    drag.current = null
    if (d && dragPos && dragPos.id === d.id) {
      updateSticker(tripId, day, d.id, { x: dragPos.x, y: dragPos.y })
    }
    setDragPos(null)
  }

  const topZ = () => stickers.reduce((m, s) => Math.max(m, s.z), 0) + 1

  return (
    <div className="journal-canvas-wrap">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden-file"
        onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0])}
      />

      {/* Toolbar */}
      <div className="jc-toolbar">
        <button className="btn" disabled={adding} onClick={() => fileRef.current?.click()}>
          {adding ? <span className="spin">↻</span> : '＋'} Photo → 6 stickers
        </button>
        <button className="btn ghost" disabled={bgBusy} onClick={genBackground}>
          {bgBusy ? <span className="spin">↻</span> : '✦'} AI background
        </button>
        <div className="jc-paper">
          <button className="btn ghost" onClick={() => setPaperOpen((v) => !v)}>
            Paper ▾
          </button>
          {paperOpen && (
            <div className="jc-paper-menu">
              {PAPERS.map((p) => (
                <button
                  key={p.id}
                  className="jc-paper-swatch"
                  title={p.label}
                  style={{ background: p.css }}
                  onClick={() => {
                    setBackground(tripId, day, `paper:${p.id}`)
                    setPaperOpen(false)
                  }}
                />
              ))}
              {page?.background && (
                <button
                  className="mini-btn"
                  onClick={() => {
                    setBackground(tripId, day, undefined)
                    setPaperOpen(false)
                  }}
                >
                  clear
                </button>
              )}
            </div>
          )}
        </div>
        <button
          className={`btn ghost ${debugOpen ? 'on' : ''}`}
          title="Show the raw generated sheet + segmentation details"
          onClick={() => setDebugOpen((v) => !v)}
        >
          🐞 Debug
        </button>
      </div>

      {note && <div className="banner">{note}</div>}

      {/* Debug: the raw sheet the model returned + how segmentation read it */}
      {debugOpen && (
        <div className="jc-section jc-debug">
          {!debug ? (
            <div className="tray-hint">
              Upload a photo to capture the raw sheet here. (Nothing generated yet this session.)
            </div>
          ) : (
            <>
              <div className="jc-debug-stats">
                <span className="u-label">Sheet {debug.info.w}×{debug.info.h}</span>
                <span>
                  corner{' '}
                  <span
                    className="jc-swatch"
                    style={{
                      background: `rgb(${debug.info.corner.r},${debug.info.corner.g},${debug.info.corner.b})`,
                    }}
                  />
                  rgb({debug.info.corner.r},{debug.info.corner.g},{debug.info.corner.b})
                </span>
                <span>green {debug.info.greenPct}%</span>
                <span>blobs {debug.info.blobs}</span>
                <span>method {debug.info.method}</span>
                <span>kept {debug.info.kept}</span>
              </div>
              <span className="u-label">Raw sheet from the model</span>
              <img className="jc-debug-sheet" src={debug.sheet} alt="raw sheet" />
              <span className="u-label">Segmented into {debug.tiles.length}</span>
              <div className="jc-lib">
                {debug.tiles.map((t, i) => (
                  <div key={i} className="jc-lib-item">
                    <span className="jc-lib-place" style={{ cursor: 'default' }}>
                      <img src={t} alt="" />
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* The page */}
      <div
        className="journal-canvas"
        ref={canvasRef}
        style={{ background: backgroundStyle(page?.background) }}
        onPointerDown={() => setSelected(null)}
      >
        {visible.length === 0 && (
          <div className="jc-empty">Add photo stickers · pick a background · drag things around</div>
        )}
        {visible.map((s) => {
          const live = dragPos && dragPos.id === s.id ? dragPos : s
          return (
            <div
              key={s.id}
              className={`jc-sticker ${selected === s.id ? 'selected' : ''}`}
              style={{
                left: `${live.x * 100}%`,
                top: `${live.y * 100}%`,
                width: `${BASE_WIDTH_PCT * s.scale}%`,
                transform: `translate(-50%, -50%) rotate(${s.rot}deg)`,
                zIndex: s.z,
              }}
              onPointerDown={(e) => onDown(e, s)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <img src={s.src} alt={s.label || 'sticker'} draggable={false} />
            </div>
          )
        })}
      </div>

      {/* Selected-sticker controls */}
      {sel && (
        <div className="jc-controls">
          <span className="u-label">Sticker</span>
          <button className="mini-btn" title="Smaller" onClick={() => updateSticker(tripId, day, sel.id, { scale: clamp(sel.scale / 1.15, 0.4, 2.6) })}>
            −
          </button>
          <button className="mini-btn" title="Bigger" onClick={() => updateSticker(tripId, day, sel.id, { scale: clamp(sel.scale * 1.15, 0.4, 2.6) })}>
            ＋
          </button>
          <button className="mini-btn" title="Rotate left" onClick={() => updateSticker(tripId, day, sel.id, { rot: sel.rot - 15 })}>
            ⟲
          </button>
          <button className="mini-btn" title="Rotate right" onClick={() => updateSticker(tripId, day, sel.id, { rot: sel.rot + 15 })}>
            ⟳
          </button>
          <button className="mini-btn" title="Bring to front" onClick={() => updateSticker(tripId, day, sel.id, { z: topZ() })}>
            ⤒ front
          </button>
          <button className="mini-btn" title="Hide (to tray)" onClick={() => { updateSticker(tripId, day, sel.id, { hidden: true }); setSelected(null) }}>
            🙈 hide
          </button>
          <button className="mini-btn" title="Delete" onClick={() => { removeSticker(tripId, day, sel.id); setSelected(null) }}>
            🗑 delete
          </button>
        </div>
      )}

      {/* Sticker library (reusable) */}
      {(stickerLib.length > 0 || adding) && (
        <div className="jc-section">
          <span className="u-label">Your stickers · tap to place</span>
          <div className="jc-lib">
            {adding && <div className="jc-lib-item loading"><span className="spin">↻</span></div>}
            {stickerLib.map((a) => (
              <div key={a.id} className="jc-lib-item">
                <button className="jc-lib-place" title="Place on this day" onClick={() => addSticker(tripId, day, a.src)}>
                  <img src={a.src} alt="" draggable={false} />
                </button>
                <button className="jc-lib-del" title="Remove from library" onClick={() => removeAsset(tripId, a.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Background library (reusable) */}
      {bgLib.length > 0 && (
        <div className="jc-section">
          <span className="u-label">Backgrounds · tap to use</span>
          <div className="jc-lib">
            {bgLib.map((a) => (
              <div key={a.id} className="jc-lib-item bg">
                <button className="jc-lib-place" title="Use on this day" onClick={() => setBackground(tripId, day, a.src)}>
                  <img src={a.src} alt="" draggable={false} />
                </button>
                <button className="jc-lib-del" title="Remove from library" onClick={() => removeAsset(tripId, a.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden-sticker tray (this day) */}
      {hidden.length > 0 && (
        <div className="jc-tray">
          <span className="u-label">Hidden</span>
          {hidden.map((s) => (
            <button
              key={s.id}
              className="jc-tray-item"
              title="Tap to place back"
              onClick={() => updateSticker(tripId, day, s.id, { hidden: false, z: topZ() })}
            >
              <img src={s.src} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}

      {/* Day caption */}
      <textarea
        className="jc-caption"
        placeholder="Write about this day…"
        value={page?.caption ?? ''}
        onChange={(e) => setCaption(tripId, day, e.target.value)}
      />
    </div>
  )
}
