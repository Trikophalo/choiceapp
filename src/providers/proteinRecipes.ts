import type { Card, DeckProvider, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle } from '@/lib/random'
import { FALLBACK_MEALS } from '@/data/fallbackMeals'

/**
 * Protein-focused recipes from TheMealDB: the protein-heavy categories
 * (chicken, beef, seafood, pork, lamb) plus an ingredient-keyword score.
 *
 * Honesty note: TheMealDB carries no macro data, so this is a heuristic for
 * "protein-forward dishes" — the badge says "high protein", never an invented
 * gram figure.
 */

const BASE = 'https://www.themealdb.com/api/json/v1/1'
const PROTEIN_CATEGORIES = ['Chicken', 'Beef', 'Seafood', 'Pork', 'Lamb', 'Goat']

const PROTEIN_KEYWORDS = [
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'egg', 'fish', 'salmon',
  'tuna', 'shrimp', 'prawn', 'tofu', 'lentil', 'bean', 'chickpea', 'quark',
  'cottage cheese', 'yogurt', 'steak', 'mince',
]

interface RawMeal {
  idMeal: string
  strMeal: string
  strMealThumb: string | null
  strCategory?: string | null
  strArea?: string | null
  strInstructions?: string | null
  strYoutube?: string | null
  strSource?: string | null
  [key: string]: string | null | undefined
}

function ingredientsOf(meal: RawMeal): string[] {
  const list: string[] = []
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]
    const measure = meal[`strMeasure${i}`]
    if (typeof name === 'string' && name.trim()) {
      const m = typeof measure === 'string' ? measure.trim() : ''
      list.push(m ? `${m} ${name.trim()}` : name.trim())
    }
  }
  return list
}

/** Exported for tests: counts distinct protein sources in an ingredient list. */
export function proteinScore(ingredients: readonly string[]): number {
  const text = ingredients.join(' ').toLowerCase()
  return PROTEIN_KEYWORDS.filter((keyword) => text.includes(keyword)).length
}

function toCard(meal: RawMeal, badge: string): Card {
  const ingredients = ingredientsOf(meal)
  return {
    id: `mealdb:${meal.idMeal}`,
    title: meal.strMeal,
    subtitle: ingredients.length
      ? ingredients
          .slice(0, 4)
          .map((entry) => entry.replace(/^[\d/.,\s]*(g|kg|ml|l|tbs|tbsp|tsp|cups?|oz|lb)?\s*/i, ''))
          .filter(Boolean)
          .join(' · ')
      : truncate(meal.strInstructions, 110),
    imageUrl: meal.strMealThumb ?? undefined,
    badge,
    meta: {
      ...(meal.strCategory ? { category: meal.strCategory } : {}),
      ...(meal.strArea ? { area: meal.strArea } : {}),
      ...(ingredients.length ? { ingredients: ingredients.join(', ') } : {}),
      ...(meal.strInstructions
        ? { instructions: truncate(meal.strInstructions, 400) }
        : {}),
    },
    sourceUrl:
      meal.strSource ||
      meal.strYoutube ||
      `https://www.themealdb.com/meal/${meal.idMeal}`,
    accentSeed: meal.idMeal,
  }
}

export const proteinRecipesProvider: DeckProvider = {
  id: 'proteinRecipes',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck({ locale, size, seed, excludeIds, signal }: DeckOptions): Promise<Card[]> {
    const badge = locale === 'de' ? 'Eiweißreich' : 'High protein'
    const excluded = new Set(excludeIds ?? [])
    try {
      const chosen = seededShuffle(PROTEIN_CATEGORIES, seed).slice(0, 3)
      const lists = await Promise.all(
        chosen.map(async (category) => {
          try {
            const res = await fetchJson<{ meals: RawMeal[] | null }>(
              `${BASE}/filter.php?c=${encodeURIComponent(category)}`,
              { signal, retries: 1 },
            )
            return res.meals ?? []
          } catch {
            return []
          }
        }),
      )

      const pool = lists
        .flat()
        .filter((meal) => meal.strMealThumb)
        .filter((meal) => !excluded.has(`mealdb:${meal.idMeal}`))
      if (!pool.length) throw new Error('empty pool')

      const picked = seededShuffle(pool, seed).slice(0, size)
      const details = await Promise.all(
        picked.map(async (meal) => {
          try {
            const full = await fetchJson<{ meals: RawMeal[] | null }>(
              `${BASE}/lookup.php?i=${meal.idMeal}`,
              { signal, retries: 1 },
            )
            return full.meals?.[0] ?? meal
          } catch {
            return meal
          }
        }),
      )

      // The categories are already protein-forward; the keyword score
      // additionally sorts the strongest matches to the front of the deck.
      return details
        .map((meal) => ({ meal, score: proteinScore(ingredientsOf(meal)) }))
        .sort((a, b) => b.score - a.score)
        .map(({ meal }) => toCard(meal, badge))
    } catch (err) {
      if (signal?.aborted) throw err
      if (import.meta.env.DEV) {
        console.info('[proteinRecipes] falling back to bundled snapshot:', err)
      }
      return seededShuffle(FALLBACK_MEALS, seed)
        .filter((meal) =>
          PROTEIN_CATEGORIES.includes((meal as RawMeal).strCategory ?? ''),
        )
        .filter((meal) => !excluded.has(`mealdb:${(meal as RawMeal).idMeal}`))
        .slice(0, size)
        .map((meal) => toCard(meal as RawMeal, badge))
    }
  },
}
