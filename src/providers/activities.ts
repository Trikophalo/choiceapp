import type { Card, DeckProvider, DeckOptions } from '@/types'
import { seededShuffle } from '@/lib/random'
import { findPhotos } from '@/lib/photos'
import { ACTIVITIES } from '@/data/activities'

// The original Bored API shut down in 2024 and community mirrors are
// unreliable, English-only and image-less. A curated bilingual dataset beats
// any free API here: no rate limits, no CORS, no shutdown risk, works offline,
// and the copy is written properly in both languages.
export const activitiesProvider: DeckProvider = {
  id: 'activities',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck({ locale, size, seed, signal }: DeckOptions): Promise<Card[]> {
    const picked = seededShuffle(ACTIVITIES, seed).slice(0, size)

    // The dataset carries the text; Commons supplies the photograph. A miss
    // simply leaves imageUrl undefined and the gradient tile takes over.
    const photos = await findPhotos(
      picked.map((activity) => activity.photo),
      800,
      signal,
    )

    return picked.map((activity, index) => {
      const text = activity[locale]
      return {
        id: `activity:${activity.id}`,
        title: text.title,
        subtitle: text.subtitle,
        imageUrl: photos[index] ?? undefined,
        // Illustrative, not a photo of a specific place or event.
        imageIsStock: photos[index] ? true : undefined,
        badge: text.badge,
        meta: { tags: activity.tags.join(', ') },
        accentSeed: activity.id,
      }
    })
  },
}
