import type { GeoPoint } from '@/types'
import { fetchJson } from './http'

/**
 * Keyless photo lookup via the Wikimedia Commons API.
 *
 * Commons is free, needs no account, allows browser calls (`origin=*`) and is
 * generous about rate limits — which makes it the only realistic way to put
 * real photographs on cards whose own source has none (activities, and
 * restaurants when no Google key is configured).
 *
 * Results are cached per query for the session: a deck reuses the same cuisine
 * or theme repeatedly, and Commons should not be asked twice for it.
 */

const ENDPOINT = 'https://commons.wikimedia.org/w/api.php'
const cache = new Map<string, string | null>()

interface CommonsResponse {
  query?: {
    pages?: Record<
      string,
      { imageinfo?: Array<{ thumburl?: string; url?: string }> }
    >
  }
}

function extractThumb(res: CommonsResponse): string | null {
  const pages = Object.values(res.query?.pages ?? {})
  return (
    pages
      .map((page) => page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url)
      .find(
        (candidate): candidate is string =>
          typeof candidate === 'string' &&
          candidate.startsWith('https://') &&
          // Skip vector/animated assets that render poorly as a card photo.
          !/\.(svg|gif)$/i.test(candidate),
      ) ?? null
  )
}

/**
 * Turns an OSM `wikimedia_commons=File:…` tag into a sized thumbnail URL.
 * Mappers attach these to the venue itself, so when the tag exists it is a
 * genuine photo of that restaurant — the best match available without a key.
 * Special:FilePath needs no API call; it redirects straight to the thumb.
 */
export function commonsFileUrl(
  tag: string | undefined,
  width = 1280,
): string | undefined {
  if (!tag) return undefined
  const first = tag.split(';')[0]?.trim() ?? ''
  if (!/^File:/i.test(first)) return undefined // e.g. Category:… is a folder
  const name = first.replace(/^File:/i, '').trim()
  if (!name || !/\.(jpe?g|png|webp)$/i.test(name)) return undefined
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    name,
  )}?width=${width}`
}

/**
 * Photos taken AT a location (Commons geosearch). For a restaurant with no
 * tagged image this is the closest thing to a picture of the actual venue:
 * a photo captured within ~80 m of its coordinates.
 */
export async function findPhotoNear(
  point: GeoPoint,
  width = 1280,
  signal?: AbortSignal,
): Promise<string | null> {
  const key = `geo:${point.lat.toFixed(5)},${point.lng.toFixed(5)}@${width}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'geosearch',
    ggscoord: `${point.lat}|${point.lng}`,
    ggsradius: '80',
    ggslimit: '4',
    ggsnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: String(width),
  })

  try {
    const res = await fetchJson<CommonsResponse>(`${ENDPOINT}?${params}`, {
      signal,
      retries: 0,
      timeoutMs: 5000,
    })
    const url = extractThumb(res)
    cache.set(key, url)
    return url
  } catch {
    cache.set(key, null)
    return null
  }
}

/** Requests a thumbnail at `width`, so Commons resizes server-side rather than
 *  us shipping a 4000px original to a phone. */
export async function findPhoto(
  query: string,
  width = 1280,
  signal?: AbortSignal,
): Promise<string | null> {
  const key = `${query}@${width}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*', // CORS for anonymous browser requests.
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6', // File: namespace only.
    gsrlimit: '4',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: String(width),
  })

  try {
    const res = await fetchJson<CommonsResponse>(`${ENDPOINT}?${params}`, {
      signal,
      retries: 0,
      timeoutMs: 5000,
    })
    const url = extractThumb(res)
    cache.set(key, url)
    return url
  } catch {
    cache.set(key, null) // Remember the miss; do not retry all deck long.
    return null
  }
}

/**
 * Resolves photos for several queries at once, tolerating individual misses.
 *
 * Photos are an enhancement, never a gate: the whole lookup is bounded by
 * `budgetMs`, so a slow or unreachable Commons costs a short wait and a set of
 * gradient tiles rather than holding the deck — and the round — hostage.
 */
export async function findPhotos(
  queries: readonly string[],
  width = 1280,
  signal?: AbortSignal,
  budgetMs = 4000,
): Promise<Array<string | null>> {
  const empty = queries.map(() => null)
  const lookup = Promise.all(
    queries.map((query) => findPhoto(query, width, signal)),
  )
  const budget = new Promise<Array<string | null>>((resolve) =>
    setTimeout(() => resolve(empty), budgetMs),
  )
  return Promise.race([lookup, budget])
}
