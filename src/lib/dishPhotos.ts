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
 * café, a stone-oven pizza for the pizzeria. Two keyless sources, best first:
 *
 *  1. TheMealDB — consistent plated-dish photography per national cuisine
 *     (the same source the recipes category uses, so the app looks coherent).
 *     One list call per area/term, cached for the session; each card draws a
 *     different dish from the pool so two Italian places don't show the same
 *     pasta photo.
 *  2. Wikimedia Commons with a curated query per cuisine, as fallback.
 */

const MEALDB = 'https://www.themealdb.com/api/json/v1/1'
const thumbCache = new Map<string, Promise<string[]>>()

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

  if (source.mealdbArea || source.mealdbSearch) {
    const thumbs = await mealThumbs(
      source.mealdbArea ? 'area' : 'search',
      source.mealdbArea ?? source.mealdbSearch!,
      signal,
    )
    if (thumbs.length) {
      const rand = mulberry32(hashSeed(seed))
      return thumbs[Math.floor(rand() * thumbs.length)]
    }
  }

  return findPhoto(source.commons, 1280, signal)
}
