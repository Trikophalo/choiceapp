import type { Card, DeckProvider, DeckOptions, GeoPoint } from '@/types'
import { fetchJson, truncate } from '@/lib/http'
import { seededShuffle } from '@/lib/random'
import { dishPhotoFor } from '@/lib/dishPhotos'

/**
 * Restaurants run a dual-provider strategy:
 *
 *  - OpenStreetMap Overpass (default): keyless, free, CORS-enabled, works for
 *    everyone with zero setup — but OSM almost never carries photos.
 *  - Google Places (New) (optional): supplies a real photo of each restaurant.
 *    Enabled only when a referrer-restricted key is configured at build time,
 *    so the free path never depends on a billing account.
 *
 * Star ratings are deliberately not shown anywhere: the decision should come
 * from the swipe, not from a score. Cards are labelled with distance instead.
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

function distanceM(a: GeoPoint, b: GeoPoint): number {
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

function formatDistance(meters: number | null): string | undefined {
  if (meters == null) return undefined
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

function elementPoint(element: OverpassElement): GeoPoint | null {
  return element.center
    ? { lat: element.center.lat, lng: element.center.lon }
    : element.lat != null && element.lon != null
      ? { lat: element.lat, lng: element.lon }
      : null
}

function osmToCard(element: OverpassElement, origin: GeoPoint): Card | null {
  const tags = element.tags ?? {}
  const name = tags.name
  if (!name) return null // Unnamed nodes make useless cards.

  const point = elementPoint(element)

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
    // Image resolved in a later pass: always a dish photo matching the
    // cuisine (product decision — a coffee for the café, a stone-oven pizza
    // for the pizzeria), never a random venue/street photo.
    imageUrl: undefined,
    badge: formatDistance(meters) ?? cuisine,
    meta: {
      ...(cuisine ? { cuisine } : {}),
      ...(tags.amenity ? { amenity: tags.amenity } : {}),
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
        .filter((card) => !(opts.excludeIds ?? []).includes(card.id))
      if (!cards.length) return []

      const deck = seededShuffle(cards, seed).slice(0, size)

      // Every card gets a dish photo matching its cuisine/amenity (see
      // lib/dishPhotos). Bounded by a time budget: photos enhance, never gate.
      await Promise.race([
        Promise.all(
          deck.map(async (card, index) => {
            const photo = await dishPhotoFor(
              card.meta?.cuisine,
              card.meta?.amenity,
              `${seed}:${index}`,
              signal,
            )
            if (photo) {
              card.imageUrl = photo
              // A matching dish, not this venue's own food — flagged so the
              // detail sheet stays honest about it.
              card.imageIsStock = true
            }
          }),
        ),
        new Promise((finish) => setTimeout(finish, 5000)),
      ])

      return deck
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
  priceLevel?: string
  editorialSummary?: { text: string }
  primaryTypeDisplayName?: { text: string }
  photos?: Array<{ name: string }>
  location?: { latitude: number; longitude: number }
}

function googleToCard(place: GooglePlace, origin: GeoPoint): Card {
  const photo = place.photos?.[0]?.name
  const point = place.location
    ? { lat: place.location.latitude, lng: place.location.longitude }
    : null
  const meters = point ? Math.round(distanceM(origin, point)) : null

  return {
    id: `gplaces:${place.id}`,
    title: place.displayName?.text ?? 'Restaurant',
    subtitle:
      place.editorialSummary?.text ??
      ([place.primaryTypeDisplayName?.text, place.shortFormattedAddress]
        .filter(Boolean)
        .join(' · ') ||
        undefined),
    // The actual Google photo of the place. maxWidthPx keeps portrait shots
    // from being cropped to a letterbox on the card.
    imageUrl: photo
      ? `https://places.googleapis.com/v1/${photo}/media?maxHeightPx=1600&maxWidthPx=1280&key=${GOOGLE_KEY}`
      : undefined,
    badge: formatDistance(meters) ?? place.primaryTypeDisplayName?.text,
    meta: {
      ...(place.priceLevel ? { priceLevel: place.priceLevel } : {}),
      ...(place.formattedAddress ? { address: place.formattedAddress } : {}),
      ...(meters != null ? { distanceM: String(meters) } : {}),
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
  const { location, radiusM = 3000, size, seed, locale, signal } = opts
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

  const places = res.places ?? []
  return seededShuffle(
    places.map((place) => googleToCard(place, location)),
    seed,
  ).slice(0, size)
}

/* ---------------- Public provider ---------------- */

export const restaurantsProvider: DeckProvider = {
  id: 'restaurants',
  capabilities: { needsLocation: true, supportsRatingFilter: false },

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
