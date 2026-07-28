// Tiny store controlling the add/edit place modal, so any view can open it.
import { create } from 'zustand'
import type { Place } from '../types'

interface EditorState {
  open: boolean
  place: Place | null // null = adding new
  defaultDay?: string // preselect a day (or undefined = wishlist)
  openEditor: (place?: Place, defaultDay?: string) => void
  closeEditor: () => void
}

export const useEditor = create<EditorState>((set) => ({
  open: false,
  place: null,
  defaultDay: undefined,
  openEditor: (place, defaultDay) =>
    set({ open: true, place: place ?? null, defaultDay }),
  closeEditor: () => set({ open: false, place: null, defaultDay: undefined }),
}))
