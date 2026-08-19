import type { Card, DeckProvider, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle, hashSeed } from '@/lib/random'

/**
 * Anime via Jikan v4 (the unofficial MyAnimeList API) — keyless, CORS-enabled,
 * large cover art. Rate limits are tight (~3 req/s, 60/min), so a deck costs
 * exactly two calls.
 *
 * Content safety: `sfw=true` excludes adult-rated entries server-side, and a
 * client-side rating guard drops anything the flag might miss. Cards without
 * cover art are dropped — every card shows the title's real artwork.
 */

const JIKAN = 'https://api.jikan.moe/v4'

/** MAL ratings allowed into a deck. */
const ALLOWED_RATINGS = /^(G|PG|PG-13|R - 17\+)/

interface JikanAnime {
  mal_id: number
  title: string
  title_english: string | null
  synopsis: string | null
  year: number | null
  rating: string | null
  genres: Array<{ name: string }>
  images: { jpg: { image_url?: string; large_image_url?: string } }
  url: string
  episodes: number | null
}

function toCard(anime: JikanAnime): Card {
  const title = anime.title_english ?? anime.title
  const genres = anime.genres.map((genre) => genre.name)
  return {
    id: `mal:${anime.mal_id}`,
    title,
    subtitle: truncate(anime.synopsis, 120),
    imageUrl: anime.images.jpg.large_image_url ?? anime.images.jpg.image_url,
    badge: anime.year ? String(anime.year) : genres[0],
    meta: {
      ...(anime.year ? { year: String(anime.year) } : {}),
      ...(genres.length ? { genres: genres.join(', ') } : {}),
      ...(anime.episodes ? { episodes: String(anime.episodes) } : {}),
      ...(anime.synopsis ? { overview: truncate(anime.synopsis, 500) } : {}),
    },
    sourceUrl: anime.url,
    accentSeed: String(anime.mal_id),
  }
}

export const animeProvider: DeckProvider = {
  id: 'anime',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck({ size, seed, excludeIds, signal }: DeckOptions): Promise<Card[]> {
    const excluded = new Set(excludeIds ?? [])
    // Rotate through the top-anime pages so redeals bring new titles.
    const base = 1 + (hashSeed(seed) % 6)
    const pages = [base, base + 1]

    const batches: JikanAnime[][] = []
    for (const page of pages) {
      // Sequential on purpose: Jikan throttles parallel bursts hard.
      try {
        const res = await fetchJson<{ data: JikanAnime[] }>(
          `${JIKAN}/top/anime?filter=bypopularity&sfw=true&limit=25&page=${page}`,
          { signal, retries: 1, timeoutMs: 10_000 },
        )
        batches.push(res.data ?? [])
      } catch {
        batches.push([])
      }
    }

    const seen = new Set<number>()
    const pool = batches.flat().filter((anime) => {
      if (seen.has(anime.mal_id)) return false
      seen.add(anime.mal_id)
      if (excluded.has(`mal:${anime.mal_id}`)) return false
      if (anime.rating && !ALLOWED_RATINGS.test(anime.rating)) return false
      return Boolean(
        anime.images.jpg.large_image_url ?? anime.images.jpg.image_url,
      )
    })

    return seededShuffle(pool, seed).slice(0, size).map(toCard)
  },
}
