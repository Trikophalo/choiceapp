import type { Card, DeckProvider, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle, hashSeed } from '@/lib/random'

/**
 * Anime. Primary source: AniList's GraphQL API — keyless, explicitly built for
 * browser use (CORS on every response), `isAdult: false` filters adult titles
 * server-side, and `coverImage.extraLarge` is real cover art.
 *
 * Jikan v4 (MyAnimeList) is the fallback: also keyless, but its CORS behaviour
 * has proven less dependable in the wild, which is why it lost primary status.
 * Cards without cover art are dropped — every card shows the title's artwork.
 */

const ANILIST = 'https://graphql.anilist.co'
const JIKAN = 'https://api.jikan.moe/v4'

/* ---------------- AniList ---------------- */

const ANILIST_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      id
      title { english romaji }
      description(asHtml: false)
      seasonYear
      episodes
      genres
      coverImage { extraLarge large }
      siteUrl
    }
  }
}`

interface AniListMedia {
  id: number
  title: { english: string | null; romaji: string | null }
  description: string | null
  seasonYear: number | null
  episodes: number | null
  genres: string[]
  coverImage: { extraLarge: string | null; large: string | null }
  siteUrl: string
}

function aniListToCard(media: AniListMedia): Card {
  const title = media.title.english ?? media.title.romaji ?? 'Untitled'
  return {
    id: `anilist:${media.id}`,
    title,
    subtitle: truncate(media.description, 120),
    imageUrl: media.coverImage.extraLarge ?? media.coverImage.large ?? undefined,
    badge: media.seasonYear ? String(media.seasonYear) : media.genres[0],
    meta: {
      ...(media.seasonYear ? { year: String(media.seasonYear) } : {}),
      ...(media.genres.length ? { genres: media.genres.join(', ') } : {}),
      ...(media.episodes ? { episodes: String(media.episodes) } : {}),
      ...(media.description
        ? { overview: truncate(media.description, 500) }
        : {}),
    },
    sourceUrl: media.siteUrl,
    accentSeed: String(media.id),
  }
}

async function fetchFromAniList(
  { size, seed, excludeIds, signal }: DeckOptions,
): Promise<Card[]> {
  const excluded = new Set(excludeIds ?? [])
  // Rotate through the popularity pages so redeals bring new titles.
  const page = 1 + (hashSeed(seed) % 4)

  const res = await fetchJson<{
    data: { Page: { media: AniListMedia[] } }
  }>(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: { page, perPage: 50 },
    }),
    retries: 1,
    timeoutMs: 10_000,
    signal,
  })

  const pool = (res.data?.Page?.media ?? []).filter(
    (media) =>
      (media.coverImage.extraLarge ?? media.coverImage.large) &&
      !excluded.has(`anilist:${media.id}`),
  )
  return seededShuffle(pool, seed).slice(0, size).map(aniListToCard)
}

/* ---------------- Jikan fallback ---------------- */

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

function jikanToCard(anime: JikanAnime): Card {
  const genres = anime.genres.map((genre) => genre.name)
  return {
    id: `mal:${anime.mal_id}`,
    title: anime.title_english ?? anime.title,
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

async function fetchFromJikan(
  { size, seed, excludeIds, signal }: DeckOptions,
): Promise<Card[]> {
  const excluded = new Set(excludeIds ?? [])
  const page = 1 + (hashSeed(seed) % 4)

  const res = await fetchJson<{ data: JikanAnime[] }>(
    `${JIKAN}/top/anime?filter=bypopularity&sfw=true&limit=25&page=${page}`,
    { signal, retries: 1, timeoutMs: 10_000 },
  )

  const pool = (res.data ?? []).filter((anime) => {
    if (excluded.has(`mal:${anime.mal_id}`)) return false
    if (anime.rating && !ALLOWED_RATINGS.test(anime.rating)) return false
    return Boolean(anime.images.jpg.large_image_url ?? anime.images.jpg.image_url)
  })
  return seededShuffle(pool, seed).slice(0, size).map(jikanToCard)
}

/* ---------------- Provider ---------------- */

export const animeProvider: DeckProvider = {
  id: 'anime',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck(opts: DeckOptions): Promise<Card[]> {
    try {
      const cards = await fetchFromAniList(opts)
      if (cards.length) return cards
      throw new Error('anilist empty')
    } catch (err) {
      if (opts.signal?.aborted) throw err
      if (import.meta.env.DEV) {
        console.info('[anime] AniList failed, trying Jikan:', err)
      }
      return fetchFromJikan(opts).catch(() => [])
    }
  },
}
