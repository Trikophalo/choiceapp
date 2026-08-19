import type { Card, DeckProvider, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { hashSeed, mulberry32, seededShuffle } from '@/lib/random'
import { FALLBACK_COCKTAILS } from '@/data/fallbackCocktails'

/**
 * TheCocktailDB — keyless for development ("1" is the shared public test key),
 * CORS-enabled, images included.
 *
 * The deck is built from `search.php?f=<letter>`: the free key caps the
 * `filter.php` list endpoints at their first ~25 rows, which are alphabetical —
 * so a filter-based deck contained almost only drinks starting with "A".
 * Letter search has no such cap, returns FULL drink objects (no per-card
 * hydration calls needed), and naturally mixes alcoholic and non-alcoholic
 * drinks into one pool.
 */
const BASE = 'https://www.thecocktaildb.com/api/json/v1/1'

// Letters weighted by how many drinks actually start with them; skips the
// nearly-empty ones (q, u, x, y) so a draw is rarely wasted.
const LETTERS = 'abcdefghijklmnoprstvwz'.split('')
const LETTERS_PER_DECK = 6

/** Deterministic letter draw — same seed, same letters, same deck. */
export function lettersForSeed(seed: string, count = LETTERS_PER_DECK): string[] {
  return seededShuffle(LETTERS, `letters:${seed}`).slice(0, count)
}

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
    subtitle: ingredients.length
      ? ingredients.slice(0, 4).join(' · ')
      : truncate(instructions, 110),
    // Full-resolution image (~700px); "/preview" is only ~250px and looks
    // blurry once upscaled onto a card.
    imageUrl: drink.strDrinkThumb ?? undefined,
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

  async fetchDeck({
    locale,
    size,
    seed,
    excludeIds,
    signal,
  }: DeckOptions): Promise<Card[]> {
    const excluded = new Set(excludeIds ?? [])
    try {
      const letters = lettersForSeed(seed)
      const batches = await Promise.all(
        letters.map(async (letter) => {
          try {
            const res = await fetchJson<{ drinks: RawDrink[] | null }>(
              `${BASE}/search.php?f=${letter}`,
              { signal, retries: 1 },
            )
            return res.drinks ?? []
          } catch {
            return [] // One dead letter must not empty the deck.
          }
        }),
      )

      const pool = batches
        .flat()
        .filter((drink) => drink.strDrinkThumb) // Cards always carry an image.
        .filter((drink) => !excluded.has(`cocktaildb:${drink.idDrink}`))
      if (!pool.length) throw new Error('empty pool')

      // Interleave rather than plain shuffle: a plain shuffle of 6 letter
      // batches can still cluster one letter; round-robin picks from each
      // letter in turn so the deck reads properly mixed.
      const byLetter = letters.map((letter) =>
        seededShuffle(
          pool.filter(
            (d) => d.strDrink.toLowerCase().startsWith(letter),
          ),
          `${seed}:${letter}`,
        ),
      )
      const mixed: RawDrink[] = []
      const rand = mulberry32(hashSeed(`${seed}:mix`))
      while (mixed.length < size && byLetter.some((b) => b.length)) {
        const nonEmpty = byLetter.filter((b) => b.length)
        const batch = nonEmpty[Math.floor(rand() * nonEmpty.length)]
        mixed.push(batch.shift()!)
      }

      return mixed.slice(0, size).map((drink) => toCard(drink, locale))
    } catch (err) {
      if (signal?.aborted) throw err
      if (import.meta.env.DEV) {
        console.info('[cocktails] falling back to bundled snapshot:', err)
      }
      return seededShuffle(FALLBACK_COCKTAILS, seed)
        .filter((d) => !excluded.has(`cocktaildb:${d.idDrink}`))
        .slice(0, size)
        .map((drink) => toCard(drink as RawDrink, locale))
    }
  },
}
