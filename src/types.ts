export type CategoryId =
  | 'restaurants'
  | 'cocktails'
  | 'recipes'
  | 'movies'
  | 'activities'

export type Locale = 'en' | 'de'

/** The one card shape every provider normalises into, so the swipe engine,
 *  sync layer and result screens stay category-agnostic. */
export interface Card {
  /** Provider-namespaced, e.g. "tmdb:603", "osm:node/240109189". */
  id: string
  title: string
  /** One-line description shown under the title. */
  subtitle?: string
  imageUrl?: string
  /** True when the image illustrates the category rather than showing this
   *  exact place or event — surfaced on the card so it cannot mislead. */
  imageIsStock?: boolean
  /** Small chip on the card, e.g. "1.2 km", "20 min". */
  badge?: string
  /** Detail rows on the result screen. */
  meta?: Record<string, string>
  /** Attribution / action link (recipe page, map directions, TMDB page). */
  sourceUrl?: string
  /** Drives the placeholder artwork when imageUrl is missing or fails. */
  accentSeed?: string
}

export interface GeoPoint {
  lat: number
  lng: number
}

export interface DeckOptions {
  locale: Locale
  /** Target deck size. */
  size: number
  /** Deterministic shuffle seed — same seed, same deck. */
  seed: string
  location?: GeoPoint
  /** Restaurants: search radius in metres (max 10000). */
  radiusM?: number
  signal?: AbortSignal
}

export interface ProviderCapabilities {
  needsLocation: boolean
  supportsRatingFilter: boolean
}

export interface DeckProvider {
  id: CategoryId
  capabilities: ProviderCapabilities
  fetchDeck(opts: DeckOptions): Promise<Card[]>
}

export type SwipeDirection = 'like' | 'nope'

/* ---------- Group session ---------- */

export type SessionStatus =
  | 'lobby'
  | 'active'
  | 'matched'
  | 'exhausted'
  | 'expired'

export interface Participant {
  name: string
  emoji: string
  joinedAt: number
  online: boolean
  /** Index of the next unswiped card — drives the "waiting for…" UI. */
  progress: number
  done: boolean
}

export interface SessionMeta {
  v: number
  category: CategoryId
  status: SessionStatus
  hostId: string
  createdAt: number
  startedAt: number | null
  locale: Locale
  filters?: { radiusM?: number }
}

export interface Winner {
  cardId: string
  decidedAt: number
  byUid: string
}

export interface SessionState {
  meta: SessionMeta
  /** Written once by the host at start — the single source of truth for
   *  content and order, so every device swipes an identical deck. */
  deck: Card[]
  participants: Record<string, Participant>
  /** Right swipes only; a left swipe just advances `progress`. */
  likes: Record<string, Record<string, true>>
  winner: Winner | null
}
