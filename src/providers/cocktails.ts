import type { Card, DeckProvider, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle } from '@/lib/random'
import { FALLBACK_COCKTAILS } from '@/data/fallbackCocktails'

// TheCocktailDB: keyless for development ("1" is the shared public test key),
// CORS-enabled, images included. Batch/random endpoints are premium-only, so
// we list ids cheaply and hydrate only the cards we actually need.
const BASE = 'https://www.thecocktaildb.com/api/json/v1/1'

interface RawDrink {
  idDrink: string
  strDrink: string
  strDrinkThumb: string | null
  strCategory?: string | null
  strAlcoholic?: string | null
  strGlass?: string | null
  strInstructions?: string | null
  strInstructionsDE?: string | null
  [key: string]: string | null | undefined
}

function ingredientsOf(drink: RawDrink): string[] {
  const list: string[] = []
  for (let i = 1; i <= 15; i++) {
    const name = drink[`strIngredient${i}`]
    if (typeof name === 'string' && name.trim()) list.push(name.trim())
  }
  return list
}

function toCard(drink: RawDrink, locale: string): Card {
  const instructions =
    (locale === 'de' ? drink.strInstructionsDE : null) ?? drink.strInstructions
  const ingredients = ingredientsOf(drink)

  return {
    id: `cocktaildb:${drink.idDrink}`,
    title: drink.strDrink,
    // Ingredients read better on a card than a wall of instructions.
    subtitle: ingredients.length
      ? ingredients.slice(0, 4).join(' · ')
      : truncate(instructions, 110),
    imageUrl: drink.strDrinkThumb
      ? `${drink.strDrinkThumb}/preview`
      : undefined,
    badge: drink.strAlcoholic ?? undefined,
    meta: {
      ...(drink.strGlass ? { glass: drink.strGlass } : {}),
      ...(drink.strCategory ? { category: drink.strCategory } : {}),
      ...(ingredients.length ? { ingredients: ingredients.join(', ') } : {}),
      ...(instructions ? { instructions: truncate(instructions, 400) } : {}),
    },
    sourceUrl: `https://www.thecocktaildb.com/drink/${drink.idDrink}`,
    accentSeed: drink.idDrink,
  }
}

export const cocktailsProvider: DeckProvider = {
  id: 'cocktails',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck({ locale, size, seed, signal }: DeckOptions): Promise<Card[]> {
    try {
      // One cheap call returns the full id/name/thumb index for the filter.
      const index = await fetchJson<{ drinks: RawDrink[] | null }>(
        `${BASE}/filter.php?a=Alcoholic`,
        { signal, retries: 1 },
      )
      const all = index.drinks ?? []
      if (!all.length) throw new Error('empty index')

      const picked = seededShuffle(all, seed).slice(0, size)

      // Hydrate only the picked drinks (details aren't in the index response).
      const details = await Promise.all(
        picked.map(async (drink) => {
          try {
            const full = await fetchJson<{ drinks: RawDrink[] | null }>(
              `${BASE}/lookup.php?i=${drink.idDrink}`,
              { signal, retries: 1 },
            )
            return full.drinks?.[0] ?? drink
          } catch {
            return drink // Keep the card; it still has a name and a photo.
          }
        }),
      )

      return details.map((drink) => toCard(drink, locale))
    } catch (err) {
      if (signal?.aborted) throw err
      // The API is occasionally rate limited; a bundled snapshot keeps the
      // category usable rather than showing an error screen.
      return seededShuffle(FALLBACK_COCKTAILS, seed)
        .slice(0, size)
        .map((drink) => toCard(drink as RawDrink, locale))
    }
  },
}
