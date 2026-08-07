import { Fragment, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import { useTrip, tripDays } from '../store/tripStore'
import type { Place } from '../types'
import { PlaceCard } from '../components/PlaceCard'
import { Sticker } from '../components/Sticker'
import { HScroll } from '../components/HScroll'
import {
  DraggableChip,
  DragHandle,
  DropZone,
  DAY_PREFIX,
  TRAY_ID,
  LIB_PREFIX,
} from '../components/dnd'
import { useEditor } from '../store/editorStore'
import { dowLabel, dayNumLabel } from '../utils/dates'

// Apple-like drop: overlay eases to its resting place, source fades back in.
const dropAnimation: DropAnimation = {
  duration: 260,
  easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.35' } },
  }),
}

// The hero view: day pages + two right columns — the wishlist and a library of
// every place you've added (drag from there to re-add on another day).
export function JournalView() {
  const trip = useTrip((s) => s.trip)
  const places = useTrip((s) => s.places)
  const assignToDay = useTrip((s) => s.assignToDay)
  const moveToWishlist = useTrip((s) => s.moveToWishlist)
  const moveInDay = useTrip((s) => s.moveInDay)
  const copyPlaceToDay = useTrip((s) => s.copyPlaceToDay)
  const openEditor = useEditor((s) => s.openEditor)
  const [activeId, setActiveId] = useState<string | null>(null)
  // Where the dragged item would land: { day, index } with index a full-list
  // position (0..count). Drives the insertion indicator and the drop target.
  const [insertAt, setInsertAt] = useState<{ day: string; index: number } | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const days = tripDays(trip)
  const wishlist = places.filter((p) => p.status === 'wishlist')

  // Library = one chip per unique place (by name + rough coords), so you can
  // re-add the same spot to several days.
  const library = useMemo(() => {
    const seen = new Map<string, Place>()
    for (const p of places) {
      const key = `${p.name.toLowerCase()}|${p.lat?.toFixed(3) ?? ''}|${p.lng?.toFixed(3) ?? ''}`
      if (!seen.has(key)) seen.set(key, p)
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [places])

  const activePlace = activeId
    ? places.find((p) => p.id === activeId.replace(LIB_PREFIX, '')) ?? null
    : null

  const byDay = useMemo(() => {
    const map: Record<string, Place[]> = {}
    for (const d of days) {
      map[d] = places
        .filter((p) => p.status === 'scheduled' && p.dayDate === d)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
    return map
  }, [places, days])

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  // As the pointer moves over a day, work out which slot it's hovering so we can
  // show an insertion line and drop it there (not just append to the bottom).
  function onDragMove(e: DragMoveEvent) {
    const over = e.over?.id ? String(e.over.id) : null
    if (!over || !over.startsWith(DAY_PREFIX)) {
      if (insertAt) setInsertAt(null)
      return
    }
    const day = over.slice(DAY_PREFIX.length)
    // Follow the cursor: activator start Y + accumulated drag delta.
    const act = e.activatorEvent as PointerEvent
    const pointerY = (act?.clientY ?? 0) + e.delta.y
    const index = insertIndexForDay(day, pointerY)
    setInsertAt((prev) => (prev?.day === day && prev.index === index ? prev : { day, index }))
  }

  function onDragEnd(e: DragEndEvent) {
    const insert = insertAt
    setActiveId(null)
    setInsertAt(null)
    const raw = String(e.active.id)
    const over = e.over?.id ? String(e.over.id) : null
    if (!over) return
    const isLib = raw.startsWith(LIB_PREFIX)
    const placeId = isLib ? raw.slice(LIB_PREFIX.length) : raw
    if (over.startsWith(DAY_PREFIX)) {
      const day = over.slice(DAY_PREFIX.length)
      const list = byDay[day] ?? []
      const fullIndex = insert?.day === day ? insert.index : list.length
      // Convert the full-list position to an index among the OTHER items: when a
      // same-day card moves down past its own slot, everything after it shifts up.
      const cur = list.findIndex((p) => p.id === placeId)
      const at = !isLib && cur !== -1 && fullIndex > cur ? fullIndex - 1 : fullIndex
      if (isLib) copyPlaceToDay(placeId, day, at)
      else assignToDay(placeId, day, at)
    } else if (over === TRAY_ID && !isLib) {
      moveToWishlist(placeId)
    }
  }

  function onDragCancel() {
    setActiveId(null)
    setInsertAt(null)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <div className="journal">
        <HScroll className="journal-scroll">
          {days.map((d) => (
            <DropZone key={d} id={DAY_PREFIX + d} className="day-page" dayId={d}>
              <h3>{dayNumLabel(d)}</h3>
              <div className="dow">{dowLabel(d)}</div>
              <div className="day-entries">
                {byDay[d].length === 0 && insertAt?.day !== d && (
                  <div className="day-empty">drag a pin here ✎</div>
                )}
                {byDay[d].map((p, i) => (
                  <Fragment key={p.id}>
                    {insertAt?.day === d && insertAt.index === i && (
                      <div className="insert-line" />
                    )}
                    <div data-place-id={p.id}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <DragHandle id={p.id} />
                      </div>
                      <PlaceCard
                        place={p}
                        showTape={p.category === 'event' || p.category === 'lodging'}
                        onReorder={(dir) => moveInDay(p.id, dir)}
                      />
                      {i < byDay[d].length - 1 && <RouteTick />}
                    </div>
                  </Fragment>
                ))}
                {insertAt?.day === d && insertAt.index >= byDay[d].length && (
                  <div className="insert-line" />
                )}
              </div>
              <button className="add-stop-btn" onClick={() => openEditor(undefined, d)}>
                ＋ add stop
              </button>
            </DropZone>
          ))}
        </HScroll>

        <div className="side-trays">
          <DropZone id={TRAY_ID} className="tray">
            <h4>Wishlist</h4>
            <div className="tray-hint">Maybe-visits. Drag onto a day to schedule.</div>
            <div className="tray-list">
              {wishlist.length === 0 && <div className="day-empty">all scheduled! 🎉</div>}
              {wishlist.map((p) => (
                <DraggableChip key={p.id} place={p} />
              ))}
            </div>
          </DropZone>

          <div className="tray library">
            <h4>All places</h4>
            <div className="tray-hint">Every place you’ve added. Drag to re-add on any day.</div>
            <div className="tray-list">
              {library.length === 0 && <div className="day-empty">nothing yet</div>}
              {library.map((p) => (
                <DraggableChip key={p.id} place={p} dragId={LIB_PREFIX + p.id} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activePlace && (
          <div className="pin-chip dragging-overlay">
            <Sticker id={activePlace.stickerId} size="sm" />
            <div className="title">{activePlace.name}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// Full-list insertion index (0..count) for a day, from the dragged item's centre
// Y — the first card whose vertical centre sits below the pointer.
function insertIndexForDay(day: string, centerY: number): number {
  const container = document.querySelector(`[data-day="${day}"]`)
  if (!container) return 0
  const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-place-id]'))
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect()
    if (centerY < r.top + r.height / 2) return i
  }
  return cards.length
}

// A little dashed "route" tick connecting entries on a page.
function RouteTick() {
  return (
    <div
      style={{
        height: 14,
        marginLeft: 22,
        marginTop: -2,
        marginBottom: 4,
        borderLeft: '2px dashed var(--ink-faint)',
        opacity: 0.8,
      }}
    />
  )
}
