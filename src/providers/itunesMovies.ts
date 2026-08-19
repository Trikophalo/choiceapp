import type { Card, DeckOptions, Locale } from '@/types'
import { fetchJsonp, truncate } from '@/lib/http'
import { seededShuffle } from '@/lib/random'

/**
 * Keyless movie source: the iTunes Search API.
 *
 * TMDB needs a key, which a fresh deployment will not have — and a movie deck
 * without posters is the one category where missing images hurt most. iTunes
 * Search requires no key, no account and no billing, supports CORS, is
 * localised per storefront, and ships real artwork. It is therefore the default
 * movie source, with TMDB taking over when a key is configured.
 */

const ENDPOINT = 'https://itunes.apple.com/search'

// iTunes has no "discover" endpoint, so a deck is assembled from genre terms.
const TERMS = [
  'action', 'comedy', 'drama', 'thriller', 'science fiction',
  'adventure', 'animation', 'romance', 'crime', 'fantasy',
]

interface ITunesResult {
  trackId?: number
  trackName?: string
  collectionId?: number
  collectionName?: string
  artistName?: string
  artworkUrl100?: string
  longDescription?: string
  shortDescription?: string
  primaryGenreName?: string
  releaseDate?: string
  trackViewUrl?: string
  collectionViewUrl?: string
  contentAdvisoryRating?: string
}

/**
 * artworkUrl100 is a 100px thumbnail, but the path segment encodes the size
 * and the CDN renders any requested box on demand. 1200x1800 keeps a movie
 * poster sharp on a 3x phone display instead of a blurry upscale.
 */
export function upscaleArtwork(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.replace(/\/\d+x\d+(bb)?\.(jpg|png)$/i, '/1200x1800bb.jpg')
}

function toCard(item: ITunesResult): Card {
  const year = item.releaseDate ? item.releaseDate.slice(0, 4) : undefined
  const description = item.longDescription ?? item.shortDescription ?? ''
  // TV seasons ("Breaking Bad, Season 1") read better as the show name.
  const title =
    item.trackName ??
    item.artistName ??
    item.collectionName?.replace(/,?\s+(Season|Staffel|Vol\.?)\s+\d+.*$/i, '') ??
    'Untitled'

  return {
    id: `itunes:${item.trackId ?? item.collectionId}`,
    title,
    subtitle: truncate(description, 120),
    imageUrl: upscaleArtwork(item.artworkUrl100),
    badge: year ?? item.primaryGenreName,
    meta: {
      ...(year ? { year } : {}),
      ...(item.primaryGenreName ? { category: item.primaryGenreName } : {}),
      ...(item.contentAdvisoryRating ? { rated: item.contentAdvisoryRating } : {}),
      ...(description ? { overview: truncate(description, 600) } : {}),
    },
    sourceUrl: item.trackViewUrl ?? item.collectionViewUrl,
    accentSeed: String(item.trackId ?? item.collectionId),
  }
}

/** German storefront and language when the round is in German. */
function storefront(locale: Locale): { country: string; lang: string } {
  return locale === 'de'
    ? { country: 'DE', lang: 'de_de' }
    : { country: 'US', lang: 'en_us' }
}

export async function fetchItunesMovies(opts: DeckOptions): Promise<Card[]> {
  return fetchItunesCatalog(opts, 'movie')
}

export async function fetchItunesSeries(opts: DeckOptions): Promise<Card[]> {
  return fetchItunesCatalog(opts, 'tvShow')
}

async function fetchItunesCatalog(
  { locale, size, seed, excludeIds }: DeckOptions,
  media: 'movie' | 'tvShow',
): Promise<Card[]> {
  const { country, lang } = storefront(locale)
  // A few terms, shuffled by seed, give a varied deck without a discover API.
  const terms = seededShuffle(TERMS, seed).slice(0, 4)

  const batches = await Promise.all(
    terms.map(async (term) => {
      try {
        const params = new URLSearchParams({
          term,
          media,
          entity: media === 'movie' ? 'movie' : 'tvSeason',
          country,
          lang,
          limit: '25',
        })
        const res = await fetchJsonp<{ results: ITunesResult[] }>(
          `${ENDPOINT}?${params}`,
        )
        return res.results ?? []
      } catch {
        return [] // One dead term must not empty the deck.
      }
    }),
  )

  // Same title can appear under several genre terms.
  const seen = new Set<number>()
  const excluded = new Set(excludeIds ?? [])
  const unique = batches.flat().filter((item) => {
    const id = item.trackId ?? item.collectionId
    if (!id || seen.has(id)) return false
    seen.add(id)
    if (excluded.has(`itunes:${id}`)) return false
    return Boolean(item.artworkUrl100) // A card without a poster is the bug.
  })

  return seededShuffle(unique, seed).slice(0, size).map(toCard)
}
