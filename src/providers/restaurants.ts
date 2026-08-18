import type { Card, DeckProvider, DeckOptions } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle } from '@/lib/random'

/**
 * Restaurants run a dual-provider strategy:
 *
 *  - OpenStreetMap Overpass (default): keyless, free, CORS-enabled, works for
 *    everyone with zero setup — but OSM carries no ratings and rarely photos.
 *  - Google Places (New) (optional): unlocks the star-rating filter and real
 *    photos. Enabled only when a referrer-restricted key is configured at
 *    build time, so the free path never depends on a billing account.
 *
 * The UI hides the rating filter in OSM mode rather than pretending it works.
 */

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY ?? ''

export const hasGooglePlaces = (): boolean => GOOGLE_KEY.length > 0

/* ---------------- OpenStreetMap / Overpass ---------------- */

// Public instances rotate on failure — one being throttled shouldn't kill the
// category.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const CUISINE_LABELS: Record<string, string> = {
  italian: 'Italian', german: 'German', chinese: 'Chinese', japanese: 'Japanese',
  indian: 'Indian', mexican: 'Mexican', thai: 'Thai', greek: 'Greek',
  turkish: 'Turkish', french: 'French', spanish: 'Spanish', vietnamese: 'Vietnamese',
  korean: 'Korean', american: 'American', burger: 'Burger', pizza: 'Pizza',
  sushi: 'Sushi', kebab: 'Kebab', asian: 'Asian', vegan: 'Vegan',
  vegetarian: 'Vegetarian', seafood: 'Seafood', steak_house: 'Steakhouse',
  regional: 'Regional', international: 'International', coffee_shop: 'Café',
}

function prettyCuisine(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const first = raw.split(';')[0]?.trim().toLowerCase()
  if (!first) return undefined
  return (
    CUISINE_LABELS[first] ??
    first.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function osmToCard(
  element: OverpassElement,
  origin: { lat: number; lng: number },
): Card | null {
  const tags = element.tags ?? {}
  const name = tags.name
  if (!name) return null // Unnamed nodes make useless cards.

  const point = element.center
    ? { lat: element.center.lat, lng: element.center.lon }
    : element.lat != null && element.lon != null
      ? { lat: element.lat, lng: element.lon }
      : null

  const cuisine = prettyCuisine(tags.cuisine)
  const street = [tags['addr:street'], tags['addr:housenumber']]
    .filter(Boolean)
    .join(' ')
  const meters = point ? Math.round(distanceM(origin, point)) : null

  const descriptionParts = [
    cuisine,
    tags.amenity === 'cafe' ? 'Café' : undefined,
    tags.amenity === 'fast_food' ? 'Fast food' : undefined,
    street || undefined,
  ].filter(Boolean)

  return {
    id: `osm:${element.type}/${element.id}`,
    title: name,
    subtitle: descriptionParts.join(' · ') || undefined,
    imageUrl: tags.image?.startsWith('https://') ? tags.image : undefined,
    badge: meters != null
      ? meters >= 1000
        ? `${(meters / 1000).toFixed(1)} km`
        : `${meters} m`
      : cuisine,
    meta: {
      ...(cuisine ? { cuisine } : {}),
      ...(street ? { address: street } : {}),
      ...(tags['addr:city'] ? { city: tags['addr:city'] } : {}),
      ...(tags.opening_hours ? { hours: tags.opening_hours } : {}),
      ...(tags.phone ? { phone: tags.phone } : {}),
      ...(tags.website ? { website: tags.website } : {}),
      ...(meters != null ? { distanceM: String(meters) } : {}),
    },
    sourceUrl: point
      ? `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}&query_place_id=`
      : undefined,
    accentSeed: String(element.id),
  }
}

async function fetchFromOverpass(opts: DeckOptions): Promise<Card[]> {
  const { location, radiusM = 3000, size, seed, signal } = opts
  if (!location) throw new Error('location-required')

  const radius = Math.min(Math.max(radiusM, 200), 10_000)
  const query = `[out:json][timeout:20];
nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]["name"](around:${radius},${location.lat},${location.lng});
out center 120;`

  let lastError: unknown
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchJson<{ elements: OverpassElement[] }>(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeoutMs: 25_000,
        retries: 0,
        signal,
      })
      const cards = (res.elements ?? [])
        .map((el) => osmToCard(el, location))
        .filter((card): card is Card => card !== null)
      if (cards.length) return seededShuffle(cards, seed).slice(0, size)
      return []
    } catch (err) {
      if (signal?.aborted) throw err
      lastError = err // Try the next mirror.
    }
  }
  throw lastError instanceof Error ? lastError : new Error('overpass-failed')
}

/* ---------------- Google Places (New) ---------------- */

interface GooglePlace {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  shortFormattedAddress?: string
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  editorialSummary?: { text: string }
  primaryTypeDisplayName?: { text: string }
  photos?: Array<{ name: string }>
  location?: { latitude: number; longitude: number }
}

function googleToCard(place: GooglePlace): Card {
  const photo = place.photos?.[0]?.name
  return {
    id: `gplaces:${place.id}`,
    title: place.displayName?.text ?? 'Restaurant',
    subtitle:
      place.editorialSummary?.text ??
      ([place.primaryTypeDisplayName?.text, place.shortFormattedAddress]
        .filter(Boolean)
        .join(' · ') ||
        undefined),
    imageUrl: photo
      ? `https://places.googleapis.com/v1/${photo}/media?maxHeightPx=800&key=${GOOGLE_KEY}`
      : undefined,
    badge: place.rating ? `${place.rating.toFixed(1)} ★` : undefined,
    meta: {
      ...(place.rating ? { rating: place.rating.toFixed(1) } : {}),
      ...(place.userRatingCount
        ? { reviews: String(place.userRatingCount) }
        : {}),
      ...(place.priceLevel ? { priceLevel: place.priceLevel } : {}),
      ...(place.formattedAddress ? { address: place.formattedAddress } : {}),
      ...(place.editorialSummary?.text
        ? { summary: truncate(place.editorialSummary.text, 400) }
        : {}),
    },
    sourceUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      place.displayName?.text ?? '',
    )}&query_place_id=${place.id}`,
    accentSeed: place.id,
  }
}

async function fetchFromGoogle(opts: DeckOptions): Promise<Card[]> {
  const { location, radiusM = 3000, minRating, size, seed, locale, signal } = opts
  if (!location) throw new Error('location-required')

  const res = await fetchJson<{ places?: GooglePlace[] }>(
    'https://places.googleapis.com/v1/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.shortFormattedAddress',
          'places.rating',
          'places.userRatingCount',
          'places.priceLevel',
          'places.editorialSummary',
          'places.primaryTypeDisplayName',
          'places.photos',
          'places.location',
        ].join(','),
      },
      body: JSON.stringify({
        includedTypes: ['restaurant'],
        maxResultCount: 20,
        languageCode: locale,
        locationRestriction: {
          circle: {
            center: { latitude: location.lat, longitude: location.lng },
            radius: Math.min(Math.max(radiusM, 200), 10_000),
          },
        },
      }),
      timeoutMs: 15_000,
      retries: 1,
      signal,
    },
  )

  const places = (res.places ?? []).filter(
    (place) => !minRating || (place.rating ?? 0) >= minRating,
  )
  return seededShuffle(places.map(googleToCard), seed).slice(0, size)
}

/* ---------------- Public provider ---------------- */

export const restaurantsProvider: DeckProvider = {
  id: 'restaurants',
  capabilities: {
    needsLocation: true,
    // Only Google carries ratings; OSM has none, so the filter chip is hidden.
    supportsRatingFilter: hasGooglePlaces(),
  },

  async fetchDeck(opts: DeckOptions): Promise<Card[]> {
    if (hasGooglePlaces()) {
      try {
        const cards = await fetchFromGoogle(opts)
        if (cards.length) return cards
      } catch (err) {
        if (opts.signal?.aborted) throw err
        // Quota exhausted or key rejected — fall through to the free path
        // rather than failing the round.
      }
    }
    return fetchFromOverpass(opts)
  },
}
