import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'

export interface RouteSegment {
  key: string
  color: string
  points: Array<[number, number]> // lat,lng
}

// Draws one or more route segments (colored by day) over the map and animates
// each "drawing itself" when the segment set / day filter (animKey) changes.
export function RouteOverlay({
  map,
  segments,
  animKey,
}: {
  map: LeafletMap | null
  segments: RouteSegment[]
  animKey: string
}) {
  const [, force] = useState(0)

  // Re-project on every pan/zoom/resize.
  useEffect(() => {
    if (!map) return
    const rerender = () => force((n) => n + 1)
    map.on('move zoom zoomanim resize viewreset', rerender)
    return () => {
      map.off('move zoom zoomanim resize viewreset', rerender)
    }
  }, [map])

  if (!map || segments.length === 0) return null
  const size = map.getSize()

  return (
    <svg
      width={size.x}
      height={size.y}
      style={{ position: 'absolute', inset: 0, zIndex: 450, pointerEvents: 'none' }}
    >
      {segments.map((seg) => {
        const pts = seg.points.map((p) => map.latLngToContainerPoint(p))
        if (pts.length < 2) return null
        const d = pts
          .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
          .join(' ')
        return <AnimatedPath key={seg.key} d={d} color={seg.color} animKey={animKey + seg.key} />
      })}
    </svg>
  )
}

// A single segment: a soft shadow line + an inked line that draws itself once,
// then becomes solid (robust to re-projection on pan/zoom).
function AnimatedPath({ d, color, animKey }: { d: string; color: string; animKey: string }) {
  const ref = useRef<SVGPathElement | null>(null)

  useEffect(() => {
    const path = ref.current
    if (!path) return
    const len = path.getTotalLength()
    path.style.transition = 'none'
    path.style.strokeDasharray = `${len}`
    path.style.strokeDashoffset = `${len}`
    void path.getBoundingClientRect()
    path.style.transition = 'stroke-dashoffset 1.4s ease-in-out'
    path.style.strokeDashoffset = '0'
    const done = () => {
      path.style.strokeDasharray = 'none'
    }
    path.addEventListener('transitionend', done, { once: true })
    return () => path.removeEventListener('transitionend', done)
    // Re-animate only when segment identity / day filter changes, not on pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey])

  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={color + '55'}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        ref={ref}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  )
}
