import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CategoryId, GeoPoint } from '@/types'

export type ThemePreference = 'system' | 'light' | 'dark'

interface AppState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void

  category: CategoryId
  setCategory: (category: CategoryId) => void

  /** Restaurant search settings — persisted so a repeat round skips setup. */
  radiusM: number
  setRadiusM: (radiusM: number) => void
  location: GeoPoint | null
  locationLabel: string | null
  setLocation: (location: GeoPoint | null, label?: string | null) => void

  /** Display identity reused across group sessions on this device. */
  displayName: string
  emoji: string
  setIdentity: (displayName: string, emoji: string) => void
}

export const EMOJI_CHOICES = [
  '🦊', '🐼', '🐙', '🦩', '🐝', '🦉', '🐳', '🦕', '🐧', '🦁', '🐸', '🦜',
]

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },

      category: 'movies',
      setCategory: (category) => set({ category }),

      radiusM: 3000,
      setRadiusM: (radiusM) => set({ radiusM }),
      location: null,
      locationLabel: null,
      setLocation: (location, label = null) =>
        set({ location, locationLabel: label }),

      displayName: '',
      emoji: EMOJI_CHOICES[0],
      setIdentity: (displayName, emoji) => set({ displayName, emoji }),
    }),
    {
      name: 'swipedecide.app',
      // Never persist coordinates: they are used transiently for the API call
      // and rebuilt on demand.
      partialize: ({ theme, category, radiusM, displayName, emoji }) => ({
        theme, category, radiusM, displayName, emoji,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    },
  ),
)
