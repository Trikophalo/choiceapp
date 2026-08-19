import type { Card, DeckProvider, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle } from '@/lib/random'
import { FALLBACK_MOVIES } from '@/data/fallbackMovies'
import { fetchItunesMovies } from './itunesMovies'

// TMDB: free non-commercial key, CORS-enabled, and fully localised — a single
// /discover call returns a whole deck with German titles and synopses.
// Attribution is required and rendered in the app footer.
const BASE = 'https://api.themoviedb.org/3'
// w780 is the smallest TMDB size that stays sharp at 3x device pixels.
const IMAGE = 'https://image.tmdb.org/t/p/w780'
const API_KEY = import.meta.env.VITE_TMDB_KEY ?? ''

export const hasTmdbKey = (): boolean => API_KEY.length > 0

interface RawMovie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  release_date?: string
  vote_average?: number
}

function toCard(movie: RawMovie): Card {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : undefined
  return {
    id: `tmdb:${movie.id}`,
    title: movie.title,
    subtitle: truncate(movie.overview, 120),
    imageUrl: movie.poster_path ? `${IMAGE}${movie.poster_path}` : undefined,
    badge: movie.vote_average
      ? `${movie.vote_average.toFixed(1)} ★`
      : undefined,
    meta: {
      ...(year ? { year } : {}),
      ...(movie.overview ? { overview: truncate(movie.overview, 400) } : {}),
    },
    sourceUrl: `https://www.themoviedb.org/movie/${movie.id}`,
    accentSeed: String(movie.id),
  }
}

export const moviesProvider: DeckProvider = {
  id: 'movies',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck(options: DeckOptions): Promise<Card[]> {
    const { locale, size, seed, signal } = options

    if (!API_KEY) {
      // No TMDB key (the default for a fresh deployment). iTunes Search needs
      // no key at all and ships real posters, so the category stays useful
      // rather than falling back to text-only cards.
      try {
        const cards = await fetchItunesMovies(options)
        if (cards.length) return cards
      } catch (err) {
        if (signal?.aborted) throw err
      }
      return seededShuffle(FALLBACK_MOVIES, seed).slice(0, size).map(toCard)
    }

    const language = locale === 'de' ? 'de-DE' : 'en-US'
    // Rotate the page from the seed so repeat rounds don't replay the same
    // twenty blockbusters.
    const page = 1 + (Math.abs(hashCode(seed)) % 5)

    try {
      const params = new URLSearchParams({
        api_key: API_KEY,
        language,
        sort_by: 'popularity.desc',
        include_adult: 'false',
        'vote_count.gte': '200',
        page: String(page),
      })
      const res = await fetchJson<{ results: RawMovie[] }>(
        `${BASE}/discover/movie?${params}`,
        { signal, retries: 1 },
      )
      const results = res.results ?? []
      if (!results.length) throw new Error('empty results')
      return seededShuffle(results, seed).slice(0, size).map(toCard)
    } catch (err) {
      if (signal?.aborted) throw err
      // TMDB failed despite a key — try the keyless source before giving up.
      try {
        const cards = await fetchItunesMovies(options)
        if (cards.length) return cards
      } catch {
        // fall through to the bundled snapshot
      }
      return seededShuffle(FALLBACK_MOVIES, seed).slice(0, size).map(toCard)
    }
  },
}

function hashCode(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0
  return h
}
