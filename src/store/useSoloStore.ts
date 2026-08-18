import { create } from 'zustand'
import type { Card, CategoryId } from '@/types'

interface SoloState {
  category: CategoryId | null
  deck: Card[]
  index: number
  winner: Card | null
  /** True when the deck ran out with no right swipe. */
  exhausted: boolean

  begin: (category: CategoryId, deck: Card[]) => void
  /** Solo rule: the first right swipe ends the round immediately. */
  like: (card: Card) => void
  pass: () => void
  reset: () => void
}

export const useSoloStore = create<SoloState>((set) => ({
  category: null,
  deck: [],
  index: 0,
  winner: null,
  exhausted: false,

  begin: (category, deck) =>
    set({ category, deck, index: 0, winner: null, exhausted: false }),

  like: (card) => set({ winner: card }),

  pass: () =>
    set((state) => {
      const next = state.index + 1
      return next >= state.deck.length
        ? { index: next, exhausted: true }
        : { index: next }
    }),

  reset: () =>
    set({ category: null, deck: [], index: 0, winner: null, exhausted: false }),
}))
