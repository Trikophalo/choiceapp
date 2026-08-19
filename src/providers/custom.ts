import type { Card, DeckProvider, DeckOptions } from '@/types'
import { seededShuffle } from '@/lib/random'
import { useCustomStore } from '@/store/useCustomStore'

/**
 * The user's own deck. The only category where images are optional — cards
 * without one get the branded gradient tile. Images can be an https URL or an
 * uploaded photo stored as a compressed data URI (see lib/imageUpload); either
 * way they travel inside the deck snapshot, so group guests see them without
 * any upload infrastructure. */
export const customProvider: DeckProvider = {
  id: 'custom',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck({ size, seed, excludeIds }: DeckOptions): Promise<Card[]> {
    const excluded = new Set(excludeIds ?? [])
    return seededShuffle(useCustomStore.getState().entries, seed)
      .map(
        (entry): Card => ({
          id: `custom:${entry.id}`,
          title: entry.title,
          subtitle: entry.subtitle,
          imageUrl:
            entry.imageUrl?.startsWith('https://') ||
            entry.imageUrl?.startsWith('data:image/')
              ? entry.imageUrl
              : undefined,
          accentSeed: entry.id,
        }),
      )
      .filter((card) => !excluded.has(card.id))
      .slice(0, size)
  },
}
