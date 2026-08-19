import type { Card, DeckOptions, Locale } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
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
  trackId: number
  trackName: string
  artworkUrl100?: string
  longDescription?: string
  shortDescription?: string
  primaryGenreName?: string
  releaseDate?: string
  trackViewUrl?: string
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

  return {
    id: `itunes:${item.trackId}`,
    title: item.trackName,
    subtitle: truncate(description, 120),
    imageUrl: upscaleArtwork(item.artworkUrl100),
    badge: year ?? item.primaryGenreName,
    meta: {
      ...(year ? { year } : {}),
      ...(item.primaryGenreName ? { category: item.primaryGenreName } : {}),
      ...(item.contentAdvisoryRating ? { rated: item.contentAdvisoryRating } : {}),
      ...(description ? { overview: truncate(description, 600) } : {}),
    },
    sourceUrl: item.trackViewUrl,
    accentSeed: String(item.trackId),
  }
}

/** German storefront and language when the round is in German. */
function storefront(locale: Locale): { country: string; lang: string } {
  return locale === 'de'
    ? { country: 'DE', lang: 'de_de' }
    : { country: 'US', lang: 'en_us' }
}

export async function fetchItunesMovies({
  locale,
  size,
  seed,
  signal,
}: DeckOptions): Promise<Card[]> {
  const { country, lang } = storefront(locale)
  // A few terms, shuffled by seed, give a varied deck without a discover API.
  const terms = seededShuffle(TERMS, seed).slice(0, 4)

  const batches = await Promise.all(
    terms.map(async (term) => {
      try {
        const params = new URLSearchParams({
          term,
          media: 'movie',
          entity: 'movie',
          country,
          lang,
          limit: '25',
        })
        const res = await fetchJson<{ results: ITunesResult[] }>(
          `${ENDPOINT}?${params}`,
          { signal, retries: 1 },
        )
        return res.results ?? []
      } catch {
        return [] // One dead term must not empty the deck.
      }
    }),
  )

  // Same film can appear under several genre terms.
  const seen = new Set<number>()
  const unique = batches.flat().filter((item) => {
    if (!item.trackId || seen.has(item.trackId)) return false
    seen.add(item.trackId)
    return Boolean(item.artworkUrl100) // A card without a poster is the bug.
  })

  return seededShuffle(unique, seed).slice(0, size).map(toCard)
}
