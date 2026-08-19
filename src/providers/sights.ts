import type { Card, DeckProvider, DeckOptions, GeoPoint } from '@/types'
import { fetchJson } from '@/lib/http'
import { seededShuffle } from '@/lib/random'
import { commonsFileUrl, findPhoto, findPhotoNear } from '@/lib/photos'

/**
 * Sights / attractions near the user — OpenStreetMap Overpass, keyless.
 *
 * Unlike restaurants (which show matching dish photos), sights want a photo of
 * the actual place — and landmarks are exactly what Wikimedia Commons is full
 * of, so the venue-photo chain works well here:
 *   1. the element's own image / wikimedia_commons tag,
 *   2. a Commons photo taken at the coordinates (geosearch),
 *   3. a generic landmark photo, labelled as illustrative.
 */

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

const KIND_LABELS: Record<string, string> = {
  attraction: 'Attraction', museum: 'Museum', viewpoint: 'Viewpoint',
  gallery: 'Gallery', artwork: 'Artwork', zoo: 'Zoo',
  theme_park: 'Theme park', aquarium: 'Aquarium', castle: 'Castle',
  monument: 'Monument', memorial: 'Memorial', ruins: 'Ruins',
  church: 'Church', tower: 'Tower', fort: 'Fort', palace: 'Palace',
}

function point(element: OverpassElement): GeoPoint | null {
  return element.center
    ? { lat: element.center.lat, lng: element.center.lon }
    : element.lat != null && element.lon != null
      ? { lat: element.lat, lng: element.lon }
      : null
}

function distanceM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 *
      Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function kindOf(tags: Record<string, string>): string | undefined {
  const raw =
    tags.tourism && tags.tourism !== 'yes' ? tags.tourism : tags.historic
  if (!raw || raw === 'yes') return undefined
  return (
    KIND_LABELS[raw] ??
    raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function toCard(element: OverpassElement, origin: GeoPoint): Card | null {
  const tags = element.tags ?? {}
  const name = tags.name
  if (!name) return null

  const at = point(element)
  const meters = at ? Math.round(distanceM(origin, at)) : null
  const kind = kindOf(tags)

  return {
    id: `osm-sight:${element.type}/${element.id}`,
    title: name,
    subtitle: [kind, tags['addr:city']].filter(Boolean).join(' · ') || undefined,
    imageUrl: tags.image?.startsWith('https://')
      ? tags.image
      : commonsFileUrl(tags.wikimedia_commons),
    badge:
      meters != null
        ? meters >= 1000
          ? `${(meters / 1000).toFixed(1)} km`
          : `${meters} m`
        : kind,
    meta: {
      ...(kind ? { category: kind } : {}),
      ...(tags['addr:city'] ? { city: tags['addr:city'] } : {}),
      ...(tags.opening_hours ? { hours: tags.opening_hours } : {}),
      ...(tags.website ? { website: tags.website } : {}),
      ...(meters != null ? { distanceM: String(meters) } : {}),
    },
    sourceUrl: at
      ? `https://www.google.com/maps/search/?api=1&query=${at.lat},${at.lng}`
      : undefined,
    accentSeed: String(element.id),
  }
}

export const sightsProvider: DeckProvider = {
  id: 'sights',
  capabilities: { needsLocation: true, supportsRatingFilter: false },

  async fetchDeck(opts: DeckOptions): Promise<Card[]> {
    const { location, radiusM = 5000, size, seed, excludeIds, signal } = opts
    if (!location) throw new Error('location-required')
    const radius = Math.min(Math.max(radiusM, 200), 10_000)

    const query = `[out:json][timeout:20];
(
  nwr["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|zoo|theme_park|aquarium)$"]["name"](around:${radius},${location.lat},${location.lng});
  nwr["historic"~"^(castle|monument|memorial|ruins|fort|palace|tower|city_gate|archaeological_site)$"]["name"](around:${radius},${location.lat},${location.lng});
);
out center 120;`

    let elements: OverpassElement[] = []
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
        elements = res.elements ?? []
        lastError = null
        break
      } catch (err) {
        if (signal?.aborted) throw err
        lastError = err
      }
    }
    if (lastError) throw lastError instanceof Error ? lastError : new Error('overpass-failed')

    const excluded = new Set(excludeIds ?? [])
    const points = new Map<string, GeoPoint>()
    const cards: Card[] = []
    for (const el of elements) {
      const card = toCard(el, location)
      if (!card || excluded.has(card.id)) continue
      const at = point(el)
      if (at) points.set(card.id, at)
      cards.push(card)
    }
    if (!cards.length) return []

    const deck = seededShuffle(cards, seed).slice(0, size)

    await Promise.race([
      Promise.all(
        deck.map(async (card) => {
          if (card.imageUrl) return
          const at = points.get(card.id)
          if (at) {
            const near = await findPhotoNear(at, 1280, signal)
            if (near) {
              card.imageUrl = near
              return
            }
          }
          const generic = await findPhoto(
            `${card.meta?.category ?? 'landmark'} landmark`,
            1280,
            signal,
          )
          if (generic) {
            card.imageUrl = generic
            card.imageIsStock = true
          }
        }),
      ),
      new Promise((finish) => setTimeout(finish, 5000)),
    ])

    return deck
  },
}
