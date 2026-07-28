// Thin, reusable drag-and-drop primitives shared by Journal and Today views.
import type { ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Place } from '../types'
import { Sticker } from './Sticker'

export const DAY_PREFIX = 'day:'
export const TRAY_ID = 'tray'
export const LIB_PREFIX = 'lib:' // dragging one of these COPIES the place

/** A fully-draggable chip. `dragId` defaults to the place id; pass a `lib:` id
    to make dropping it create a copy instead of moving the original. */
export function DraggableChip({ place, dragId }: { place: Place; dragId?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId ?? place.id,
  })
  return (
    <div
      ref={setNodeRef}
      className={`pin-chip ${isDragging ? 'dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <Sticker id={place.stickerId} size="sm" />
      <div style={{ minWidth: 0 }}>
        <div className="title">{place.name}</div>
        {place.address && <div className="addr">{trim(place.address, 32)}</div>}
      </div>
    </div>
  )
}

/** A small drag handle (used on scheduled cards so buttons stay clickable). */
export function DragHandle({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      className="mini-btn"
      style={{ cursor: 'grab', touchAction: 'none', opacity: isDragging ? 0.4 : 0.7 }}
      title="Drag to another day / today"
      {...listeners}
      {...attributes}
    >
      ⠿ drag
    </div>
  )
}

/** A droppable zone. `id` should be `${DAY_PREFIX}<iso>` or TRAY_ID. */
export function DropZone({
  id,
  className,
  activeClassName = 'drop-active',
  children,
}: {
  id: string
  className: string
  activeClassName?: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? activeClassName : ''}`}>
      {children}
    </div>
  )
}

function trim(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}
