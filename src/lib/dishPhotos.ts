import { fetchJson } from './http'
import { findPhoto } from './photos'
import { hashSeed, mulberry32 } from './random'
import {
  AMENITY_PHOTOS,
  CUISINE_PHOTOS,
  type DishPhotoSource,
} from '@/data/cuisinePhotos'

/**
 * Resolves a dish photo that matches a restaurant's food: a coffee for the
 * café, a stone-oven pizza for the pizzeria. Three keyless sources, prettiest
 * first:
 *
 *  1. Wikipedia lead images — the article photo of "Pizza Margherita" or
 *     "Cappuccino" is curated and consistently attractive. Each cuisine maps
 *     to several dish articles and every card draws a different one, so two
 *     Italian places show different dishes.
 *  2. TheMealDB — solid plated-dish photography per national cuisine.
 *  3. Wikimedia Commons with a curated query, as the last resort.
 */

const MEALDB = 'https://www.themealdb.com/api/json/v1/1'
const thumbCache = new Map<string, Promise<string[]>>()
const wikiCache = new Map<string, Promise<string | null>>()

interface WikiSummary {
  thumbnail?: { source: string }
  originalimage?: { source: string; width: number }
}

/**
 * Lead image of an English Wikipedia article, upscaled to card size. The
 * summary endpoint returns a small thumbnail whose URL encodes its width
 * (`.../320px-Name.jpg`) — rewriting that segment asks Commons to render the
 * same image at retina size instead.
 */
function wikiLeadImage(title: string, signal?: AbortSignal): Promise<string | null> {
  let cached = wikiCache.get(title)
  if (!cached) {
    cached = fetchJson<WikiSummary>(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { signal, retries: 0, timeoutMs: 6000 },
    )
      .then((summary) => {
        const thumb = summary.thumbnail?.source
        if (thumb && /\/\d+px-/.test(thumb)) {
          return thumb.replace(/\/\d+px-/, '/1280px-')
        }
        // Non-thumb URLs (rare): take the original if it is not absurdly big.
        const original = summary.originalimage
        if (original && original.width <= 4000) return original.source
        return thumb ?? null
      })
      .catch(() => null)
    wikiCache.set(title, cached)
  }
  return cached
}

interface MealRow {
  strMealThumb: string | null
}

function mealThumbs(kind: 'area' | 'search', value: string, signal?: AbortSignal): Promise<string[]> {
  const key = `${kind}:${value}`
  let cached = thumbCache.get(key)
  if (!cached) {
    const url =
      kind === 'area'
        ? `${MEALDB}/filter.php?a=${encodeURIComponent(value)}`
        : `${MEALDB}/search.php?s=${encodeURIComponent(value)}`
    cached = fetchJson<{ meals: MealRow[] | null }>(url, {
      signal,
      retries: 1,
      timeoutMs: 6000,
    })
      .then((res) =>
        (res.meals ?? [])
          .map((meal) => meal.strMealThumb)
          .filter((thumb): thumb is string => Boolean(thumb)),
      )
      .catch(() => [])
    thumbCache.set(key, cached)
  }
  return cached
}

function normaliseCuisine(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return raw.split(';')[0]?.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function sourceFor(
  cuisine: string | undefined,
  amenity: string | undefined,
): DishPhotoSource {
  const key = normaliseCuisine(cuisine)
  if (key && CUISINE_PHOTOS[key]) return CUISINE_PHOTOS[key]
  if (amenity && AMENITY_PHOTOS[amenity]) return AMENITY_PHOTOS[amenity]
  // Unmapped cuisine: let Commons search for it literally before going generic.
  if (key) return { commons: `${key.replace(/_/g, ' ')} dish food plate` }
  return AMENITY_PHOTOS.restaurant
}

export async function dishPhotoFor(
  cuisine: string | undefined,
  amenity: string | undefined,
  seed: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const source = sourceFor(cuisine, amenity)
  const rand = mulberry32(hashSeed(seed))

  // Tier 1: a curated Wikipedia dish article's lead image, seeded per card.
  if (source.wiki?.length) {
    const title = source.wiki[Math.floor(rand() * source.wiki.length)]
    const lead = await wikiLeadImage(title, signal)
    if (lead) return lead
  }

  // Tier 2: TheMealDB plated-dish photography.
  if (source.mealdbArea || source.mealdbSearch) {
    const thumbs = await mealThumbs(
      source.mealdbArea ? 'area' : 'search',
      source.mealdbArea ?? source.mealdbSearch!,
      signal,
    )
    if (thumbs.length) return thumbs[Math.floor(rand() * thumbs.length)]
  }

  // Tier 3: Commons search.
  return findPhoto(source.commons, 1280, signal)
}
