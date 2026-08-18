import type { Card, DeckProvider, DeckOptions } from '@/types'
import { seededShuffle } from '@/lib/random'
import { ACTIVITIES } from '@/data/activities'

// The original Bored API shut down in 2024 and community mirrors are
// unreliable, English-only and image-less. A curated bilingual dataset beats
// any free API here: no rate limits, no CORS, no shutdown risk, works offline,
// and the copy is written properly in both languages.
export const activitiesProvider: DeckProvider = {
  id: 'activities',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck({ locale, size, seed }: DeckOptions): Promise<Card[]> {
    return seededShuffle(ACTIVITIES, seed)
      .slice(0, size)
      .map((activity) => {
        const text = activity[locale]
        return {
          id: `activity:${activity.id}`,
          title: text.title,
          subtitle: text.subtitle,
          badge: text.badge,
          meta: { tags: activity.tags.join(', ') },
          accentSeed: activity.id,
        }
      })
  },
}
