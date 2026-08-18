import type { Card, DeckProvider, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle } from '@/lib/random'
import { FALLBACK_MEALS } from '@/data/fallbackMeals'

// TheMealDB — same family as TheCocktailDB: keyless test key, CORS-enabled.
// Content is English-only; food names travel well across languages, and the
// category/area labels get translated through the i18n layer.
const BASE = 'https://www.themealdb.com/api/json/v1/1'

const CATEGORIES = [
  'Beef', 'Chicken', 'Dessert', 'Lamb', 'Pasta',
  'Pork', 'Seafood', 'Side', 'Starter', 'Vegetarian',
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

function toCard(meal: RawMeal): Card {
  const ingredients = ingredientsOf(meal)
  return {
    id: `mealdb:${meal.idMeal}`,
    title: meal.strMeal,
    // Ingredients tell you what the dish is; the first sentence of the method
    // does not ("Bring a large pot of salted water to a boil…").
    subtitle: ingredients.length
      ? ingredients
          .slice(0, 4)
          .map((entry) => entry.replace(/^[\d\/.,\s]*(g|kg|ml|l|tbs|tbsp|tsp|cups?|oz|lb)?\s*/i, ''))
          .filter(Boolean)
          .join(' · ')
      : truncate(meal.strInstructions, 110),
    // Full-resolution thumbnail (~700px). The "/preview" variant is only
    // ~250px and visibly soft once a card is drawn on a retina screen.
    imageUrl: meal.strMealThumb ?? undefined,
    badge: meal.strArea ?? meal.strCategory ?? undefined,
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

export const recipesProvider: DeckProvider = {
  id: 'recipes',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck({ size, seed, signal }: DeckOptions): Promise<Card[]> {
    try {
      // Spread the deck across a few categories so it doesn't read as
      // "twenty-five beef dishes".
      const chosen = seededShuffle(CATEGORIES, seed).slice(0, 4)
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

      const pool = lists.flat()
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

      return details.map(toCard)
    } catch (err) {
      if (signal?.aborted) throw err
      return seededShuffle(FALLBACK_MEALS, seed)
        .slice(0, size)
        .map((meal) => toCard(meal as RawMeal))
    }
  },
}
