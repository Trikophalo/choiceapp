import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CustomEntry {
  id: string
  title: string
  subtitle?: string
  imageUrl?: string
}

interface CustomState {
  entries: CustomEntry[]
  addEntry: (entry: Omit<CustomEntry, 'id'>) => void
  removeEntry: (id: string) => void
  clear: () => void
}

/** The user's own deck ("where do we go on holiday?" → Rome, Paris, …).
 *  Persisted so a recurring decision doesn't need retyping. */
export const useCustomStore = create<CustomState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [
            ...state.entries,
            { ...entry, id: `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}` },
          ],
        })),
      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== id),
        })),
      clear: () => set({ entries: [] }),
    }),
    { name: 'swipedecide.custom' },
  ),
)
