import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import { useTrip, tripDays } from '../store/tripStore'
import { PlaceCard } from '../components/PlaceCard'
import { Sticker } from '../components/Sticker'
import { DraggableChip, DropZone, DAY_PREFIX } from '../components/dnd'

const dropAnimation: DropAnimation = {
  duration: 260,
  easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }),
}
import { useEditor } from '../store/editorStore'
import { fullDayLabel, todayIso, dowLabel, dayNumLabel } from '../utils/dates'

// Live/travel mode: one big day at a time. Drag a wishlist pin into the day to
// add an unplanned stop on the fly.
export function TodayView() {
  const trip = useTrip((s) => s.trip)
  const places = useTrip((s) => s.places)
  const assignToDay = useTrip((s) => s.assignToDay)
  const moveInDay = useTrip((s) => s.moveInDay)
  const openEditor = useEditor((s) => s.openEditor)
  const days = tripDays(trip)

  // Default to the real "today" if we're mid-trip, otherwise day 1.
  const iso = todayIso()
  const initial = days.includes(iso) ? iso : days[0] ?? iso
  const [activeDay, setActiveDay] = useState(initial)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const wishlist = places.filter((p) => p.status === 'wishlist')
  const activePlace = places.find((p) => p.id === activeId) ?? null

  const todays = useMemo(
    () =>
      places
        .filter((p) => p.status === 'scheduled' && p.dayDate === activeDay)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [places, activeDay],
  )

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const placeId = String(e.active.id)
    const over = e.over?.id ? String(e.over.id) : null
    if (over && over.startsWith(DAY_PREFIX)) assignToDay(placeId, over.slice(DAY_PREFIX.length))
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="day-filter" style={{ position: 'static', marginBottom: 10 }}>
          {days.map((d) => (
            <button
              key={d}
              className={`day-pill ${activeDay === d ? 'active' : ''}`}
              onClick={() => setActiveDay(d)}
            >
              {dowLabel(d)} {dayNumLabel(d)}
            </button>
          ))}
        </div>

        <h2 className="today-head">{fullDayLabel(activeDay)}</h2>
        <div className="tray-hint" style={{ marginBottom: 12 }}>
          {activeDay === iso ? 'Today’s plan.' : 'Day plan.'} Drag a pin from below to add a stop.
        </div>

        <DropZone id={DAY_PREFIX + activeDay} className="today-drop">
          <div className="timeline">
            {todays.length === 0 && <div className="day-empty">Nothing scheduled yet.</div>}
            {todays.map((p) => (
              <PlaceCard
                key={p.id}
                place={p}
                showTape={p.category === 'event'}
                onReorder={(dir) => moveInDay(p.id, dir)}
              />
            ))}
          </div>
          <button className="add-stop-btn" onClick={() => openEditor(undefined, activeDay)}>
            ＋ add stop
          </button>
        </DropZone>

        <div className="section-title" style={{ marginTop: 20 }}>
          Drag in from wishlist
        </div>
        <div className="wish-grid">
          {wishlist.length === 0 && <div className="day-empty">Wishlist is empty.</div>}
          {wishlist.map((p) => (
            <DraggableChip key={p.id} place={p} />
          ))}
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
