import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// A horizontal scroller with a custom scrollbar rendered ON TOP of the content,
// plus grab-to-pan: click empty space (or a card) and drag left/right to scroll.
// The native bottom scrollbar is hidden so the top rail is the single control.
// Grab-to-pan is mouse-only — touch keeps its natural momentum scrolling, and
// drags that start on a button / input / draggable chip are left alone.
export function HScroll({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState({ left: 0, width: 0, show: false })

  // setPointerCapture throws on untrusted events; never let that block scrolling.
  const capture = (e: React.PointerEvent) => {
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* capture unavailable — pointer events still work without it */
    }
  }

  // Recompute the thumb geometry from the body's live scroll metrics.
  const sync = useCallback(() => {
    const el = bodyRef.current
    const rail = railRef.current
    if (!el || !rail) return
    const { scrollWidth, clientWidth, scrollLeft } = el
    const railW = rail.clientWidth
    if (scrollWidth <= clientWidth + 1) {
      setThumb((t) => (t.show ? { ...t, show: false } : t))
      return
    }
    const width = Math.max(44, railW * (clientWidth / scrollWidth))
    const maxScroll = scrollWidth - clientWidth
    const maxLeft = railW - width
    const left = maxScroll > 0 ? (scrollLeft / maxScroll) * maxLeft : 0
    setThumb({ left, width, show: true })
  }, [])

  useLayoutEffect(() => {
    sync()
    const el = bodyRef.current
    if (!el) return
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    if (railRef.current) ro.observe(railRef.current) // rail width settles a frame late
    for (const c of Array.from(el.children)) ro.observe(c as Element)
    window.addEventListener('resize', sync)
    // One more pass after paint, in case fonts/layout shift the metrics.
    const raf = requestAnimationFrame(sync)
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
      window.removeEventListener('resize', sync)
      cancelAnimationFrame(raf)
    }
  }, [sync, children])

  // Map a desired thumb-left (px within rail) onto the body's scrollLeft.
  const scrollToThumbLeft = (nextLeft: number) => {
    const el = bodyRef.current
    const rail = railRef.current
    if (!el || !rail) return
    const maxLeft = rail.clientWidth - thumb.width
    const maxScroll = el.scrollWidth - el.clientWidth
    const clamped = Math.min(maxLeft, Math.max(0, nextLeft))
    el.scrollLeft = maxLeft > 0 ? (clamped / maxLeft) * maxScroll : 0
  }

  // --- Drag the thumb ---
  const thumbDrag = useRef<{ startX: number; startLeft: number } | null>(null)
  const onThumbDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    thumbDrag.current = { startX: e.clientX, startLeft: thumb.left }
    capture(e)
  }
  const onThumbMove = (e: React.PointerEvent) => {
    const d = thumbDrag.current
    if (!d) return
    scrollToThumbLeft(d.startLeft + (e.clientX - d.startX))
  }
  const endThumb = (e: React.PointerEvent) => {
    thumbDrag.current = null
    try {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    } catch {
      /* capture already gone */
    }
  }

  // Click the empty rail track to jump toward the click.
  const onRailDown = (e: React.PointerEvent) => {
    if (e.target !== railRef.current) return // a click on the thumb is handled above
    const rect = railRef.current!.getBoundingClientRect()
    scrollToThumbLeft(e.clientX - rect.left - thumb.width / 2)
  }

  // --- Grab-to-pan the body (mouse only) ---
  const pan = useRef<{ startX: number; startScroll: number; active: boolean } | null>(null)
  const onBodyDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const target = e.target as Element
    if (target.closest('button, a, input, textarea, select, [data-draghandle], .pin-chip')) return
    const el = bodyRef.current
    if (!el) return
    pan.current = { startX: e.clientX, startScroll: el.scrollLeft, active: false }
  }
  const onBodyMove = (e: React.PointerEvent) => {
    const p = pan.current
    const el = bodyRef.current
    if (!p || !el) return
    const dx = e.clientX - p.startX
    if (!p.active) {
      if (Math.abs(dx) < 6) return // let small movements stay clicks
      p.active = true
      el.classList.add('panning')
      capture(e)
    }
    el.scrollLeft = p.startScroll - dx
  }
  const endPan = (e: React.PointerEvent) => {
    const el = bodyRef.current
    if (pan.current?.active && el) {
      el.classList.remove('panning')
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* capture already gone */
      }
    }
    pan.current = null
  }

  return (
    <div className="hscroll">
      <div
        className={`hscroll-rail ${thumb.show ? '' : 'is-hidden'}`}
        ref={railRef}
        onPointerDown={onRailDown}
      >
        <div
          className="hscroll-thumb"
          style={{ left: thumb.left, width: thumb.width }}
          onPointerDown={onThumbDown}
          onPointerMove={onThumbMove}
          onPointerUp={endThumb}
          onPointerCancel={endThumb}
        />
      </div>
      <div
        className={`hscroll-body ${className}`}
        ref={bodyRef}
        onPointerDown={onBodyDown}
        onPointerMove={onBodyMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {children}
      </div>
    </div>
  )
}
