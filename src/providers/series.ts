import type { Card, DeckProvider, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle, hashSeed } from '@/lib/random'
import { fetchItunesSeries } from './itunesMovies'

/**
 * TV series. Primary source: TVMaze — keyless, CORS-enabled, real cover art
 * (`image.original`), summaries and genres. `/shows?page=N` returns 250 shows
 * per page; a seeded page choice varies the deck between rounds. iTunes
 * (JSONP) is the fallback when TVMaze is down. Cards without a cover are
 * dropped: every card must show the title's actual artwork.
 */

const TVMAZE = 'https://api.tvmaze.com'

interface TvMazeShow {
  id: number
  name: string
  summary: string | null
  premiered: string | null
  genres: string[]
  language: string | null
  image: { medium: string; original: string } | null
  officialSite: string | null
  url: string
  rating?: { average: number | null }
}

function toCard(show: TvMazeShow): Card {
  const year = show.premiered ? show.premiered.slice(0, 4) : undefined
  return {
    id: `tvmaze:${show.id}`,
    title: show.name,
    subtitle: truncate(show.summary, 120),
    imageUrl: show.image?.original ?? undefined,
    badge: year ?? show.genres[0],
    meta: {
      ...(year ? { year } : {}),
      ...(show.genres.length ? { genres: show.genres.join(', ') } : {}),
      ...(show.summary ? { overview: truncate(show.summary, 500) } : {}),
    },
    sourceUrl: show.officialSite ?? show.url,
    accentSeed: String(show.id),
  }
}

export const seriesProvider: DeckProvider = {
  id: 'series',
  capabilities: { needsLocation: false, supportsRatingFilter: false },

  async fetchDeck(opts: DeckOptions): Promise<Card[]> {
    const { size, seed, excludeIds, signal } = opts
    const excluded = new Set(excludeIds ?? [])

    try {
      // Two seeded pages out of the early catalogue (dense with well-known
      // shows) give ~500 candidates for one deck.
      const base = hashSeed(seed) % 8
      const pages = [base, base + 1]
      const batches = await Promise.all(
        pages.map(async (page) => {
          try {
            return await fetchJson<TvMazeShow[]>(
              `${TVMAZE}/shows?page=${page}`,
              { signal, retries: 1 },
            )
          } catch {
            return []
          }
        }),
      )

      const pool = batches
        .flat()
        .filter(
          (show) =>
            show.image?.original && // Every card must carry the real cover.
            show.summary &&
            !excluded.has(`tvmaze:${show.id}`),
        )
      if (!pool.length) throw new Error('empty pool')

      // Well-rated shows first-ish: sort a seeded shuffle stably by rating
      // bucket so the deck skews watchable without becoming deterministic.
      const shuffled = seededShuffle(pool, seed)
        .map((show, index) => ({
          show,
          score: (show.rating?.average ?? 5) - index * 0.001,
        }))
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.show)

      return shuffled.slice(0, size).map(toCard)
    } catch (err) {
      if (signal?.aborted) throw err
      if (import.meta.env.DEV) {
        console.info('[series] TVMaze failed, trying iTunes:', err)
      }
      const fallback = await fetchItunesSeries(opts).catch(() => [])
      return fallback.filter((card) => card.imageUrl)
    }
  },
}
