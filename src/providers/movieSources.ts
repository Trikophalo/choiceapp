import type { Card, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle } from '@/lib/random'
import { upscaleArtwork } from './itunesMovies'

/**
 * Redundant keyless movie/series sources with dependable CORS, used when the
 * iTunes Search path (JSONP) yields nothing. Cover art is mandatory in every
 * tier — a card without the title's real poster is dropped.
 */

/* ---------------- Apple Marketing Tools RSS ----------------
 * Keyless JSON of the storefront's top movies, CORS-enabled (built for web
 * widgets). Artwork uses the same mzstatic size-segment trick as iTunes.
 */

interface RssEntry {
  id: string
  name: string
  artistName?: string
  releaseDate?: string
  url?: string
  artworkUrl100?: string
  genres?: Array<{ name: string }>
}

export async function fetchAppleTopMovies(
  { locale, size, seed, excludeIds, signal }: DeckOptions,
): Promise<Card[]> {
  const storefront = locale === 'de' ? 'de' : 'us'
  const res = await fetchJson<{ feed: { results: RssEntry[] } }>(
    `https://rss.applemarketingtools.com/api/v2/${storefront}/movies/top-movies/50/movies.json`,
    { signal, retries: 0, timeoutMs: 8000 },
  )

  const excluded = new Set(excludeIds ?? [])
  const pool = (res.feed?.results ?? []).filter(
    (entry) => entry.artworkUrl100 && !excluded.has(`itunes:${entry.id}`),
  )

  return seededShuffle(pool, seed)
    .slice(0, size)
    .map((entry): Card => {
      const year = entry.releaseDate ? entry.releaseDate.slice(0, 4) : undefined
      const genres = (entry.genres ?? []).map((genre) => genre.name)
      return {
        id: `itunes:${entry.id}`,
        title: entry.name,
        subtitle: genres.slice(0, 3).join(' · ') || undefined,
        imageUrl: upscaleArtwork(entry.artworkUrl100),
        badge: year ?? genres[0],
        meta: {
          ...(year ? { year } : {}),
          ...(genres.length ? { genres: genres.join(', ') } : {}),
        },
        sourceUrl: entry.url,
        accentSeed: entry.id,
      }
    })
}

/* ---------------- Cinemeta (Stremio's open catalogue) ----------------
 * Public addon endpoint; the addon protocol requires CORS `*` because
 * browsers consume it directly. Posters come from images.metahub.space.
 */

interface CinemetaMeta {
  id: string
  name: string
  poster?: string
  description?: string
  releaseInfo?: string
  imdbRating?: string
  genres?: string[]
}

/** Exported for tests: request the large poster rendition. */
export function largePoster(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.replace('/poster/small/', '/poster/large/').replace('/poster/medium/', '/poster/large/')
}

export async function fetchCinemeta(
  type: 'movie' | 'series',
  { size, seed, excludeIds, signal }: DeckOptions,
): Promise<Card[]> {
  const res = await fetchJson<{ metas: CinemetaMeta[] }>(
    `https://v3-cinemeta.strem.io/catalog/${type}/top.json`,
    { signal, retries: 0, timeoutMs: 8000 },
  )

  const excluded = new Set(excludeIds ?? [])
  const pool = (res.metas ?? []).filter(
    (meta) => meta.poster && !excluded.has(`imdb:${meta.id}`),
  )

  return seededShuffle(pool, seed)
    .slice(0, size)
    .map((meta): Card => {
      const year = meta.releaseInfo?.slice(0, 4)
      return {
        id: `imdb:${meta.id}`,
        title: meta.name,
        subtitle: truncate(meta.description, 120) || (meta.genres ?? []).slice(0, 3).join(' · ') || undefined,
        imageUrl: largePoster(meta.poster),
        badge: year ?? meta.genres?.[0],
        meta: {
          ...(year ? { year } : {}),
          ...(meta.genres?.length ? { genres: meta.genres.join(', ') } : {}),
          ...(meta.description ? { overview: truncate(meta.description, 500) } : {}),
        },
        sourceUrl: `https://www.imdb.com/title/${meta.id}/`,
        accentSeed: meta.id,
      }
    })
}
