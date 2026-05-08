import { create } from 'zustand'

interface SelectionState {
  // Current board's selected card ids. Cleared when boardId changes.
  boardId: string | null
  selected: Set<string>
  // Last clicked card on this board — used as the anchor for shift+click
  // range selection within a list.
  anchor: string | null

  setBoard: (boardId: string | null) => void
  toggle: (cardId: string) => void
  selectOnly: (cardId: string) => void
  selectMany: (cardIds: string[]) => void
  setAnchor: (cardId: string | null) => void
  clear: () => void
  isSelected: (cardId: string) => boolean
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  boardId: null,
  selected: new Set(),
  anchor: null,

  setBoard: (boardId) =>
    set((s) => {
      if (s.boardId === boardId) return s
      return { boardId, selected: new Set(), anchor: null }
    }),

  toggle: (cardId) =>
    set((s) => {
      const next = new Set(s.selected)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return { selected: next, anchor: cardId }
    }),

  selectOnly: (cardId) =>
    set(() => ({ selected: new Set([cardId]), anchor: cardId })),

  selectMany: (cardIds) =>
    set((s) => {
      const next = new Set(s.selected)
      cardIds.forEach((id) => next.add(id))
      return { selected: next, anchor: cardIds[cardIds.length - 1] || s.anchor }
    }),

  setAnchor: (cardId) => set({ anchor: cardId }),

  clear: () => set({ selected: new Set(), anchor: null }),

  isSelected: (cardId) => get().selected.has(cardId),
}))
