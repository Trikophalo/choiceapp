import type { GeoPoint } from '@/types'
import { fetchJson } from './http'

export type GeoErrorReason = 'denied' | 'unavailable'

export class GeoError extends Error {
  constructor(readonly reason: GeoErrorReason) {
    super(reason)
    this.name = 'GeoError'
  }
}

export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeoError('unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new GeoError(
            err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  })
}

export interface PlaceSuggestion {
  label: string
  point: GeoPoint
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    city?: string
    state?: string
    country?: string
    street?: string
    postcode?: string
  }
}

/**
 * Photon (Komoot) — free, keyless, CORS-enabled and typo tolerant. Used when
 * the browser denies geolocation, so the restaurant category still works.
 */
export async function searchPlaces(
  query: string,
  locale: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  if (query.trim().length < 2) return []

  const params = new URLSearchParams({
    q: query,
    limit: '5',
    lang: locale === 'de' ? 'de' : 'en',
  })
  const res = await fetchJson<{ features: PhotonFeature[] }>(
    `https://photon.komoot.io/api/?${params}`,
    { signal, retries: 1, timeoutMs: 8000 },
  )

  return (res.features ?? [])
    .map((feature) => {
      const p = feature.properties
      const label = [p.name, p.city, p.state, p.country]
        .filter((part, index, all) => part && all.indexOf(part) === index)
        .join(', ')
      const [lng, lat] = feature.geometry.coordinates
      return { label, point: { lat, lng } }
    })
    .filter((suggestion) => suggestion.label.length > 0)
}
