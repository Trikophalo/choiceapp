import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { getCurrentPosition, searchPlaces, GeoError, type PlaceSuggestion } from '@/lib/geo'
import { BackLink, Button, Screen } from '@/components/ui'
import { currentLocale } from '@/i18n'

/** Location and filter setup — only reached for location-dependent categories. */
export function Setup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mode = params.get('mode') === 'group' ? 'group' : 'solo'

  const { radiusM, setRadiusM, location, locationLabel, setLocation } = useAppStore()

  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<'denied' | 'unavailable' | null>(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const searchAbort = useRef<AbortController | null>(null)

  const useMyLocation = async () => {
    setLocating(true)
    setGeoError(null)
    try {
      const point = await getCurrentPosition()
      setLocation(point, null)
    } catch (err) {
      setGeoError(err instanceof GeoError ? err.reason : 'unavailable')
    } finally {
      setLocating(false)
    }
  }

  // Debounced city lookup, used when geolocation is denied or declined.
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      searchAbort.current?.abort()
      const controller = new AbortController()
      searchAbort.current = controller
      setSearching(true)
      try {
        setSuggestions(await searchPlaces(query, currentLocale(), controller.signal))
      } catch {
        if (!controller.signal.aborted) setSuggestions([])
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 320)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => () => searchAbort.current?.abort(), [])

  const proceed = () => navigate(mode === 'solo' ? '/solo' : '/create')

  return (
    <Screen>
      <div className="py-3">
        <BackLink to={`/categories?mode=${mode}`} label={t('common.back')} />
      </div>

      <h1 className="mb-6 text-3xl font-semibold tracking-tight">
        {t('filters.title')}
      </h1>

      <section className="rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line">
        <div className="flex items-baseline justify-between">
          <label htmlFor="radius" className="font-medium">
            {t('filters.radius')}
          </label>
          <span className="text-sm font-medium text-accent">
            {t('filters.radiusValue', { km: (radiusM / 1000).toFixed(1) })}
          </span>
        </div>
        <input
          id="radius"
          type="range"
          min={500}
          max={10000}
          step={500}
          value={radiusM}
          onChange={(e) => setRadiusM(Number(e.target.value))}
          className="mt-3 w-full accent-[var(--accent)]"
        />
      </section>

      <section className="mt-4 rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line">
        <Button variant="secondary" onClick={useMyLocation} disabled={locating} full>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          {locating ? t('filters.locating') : t('filters.useLocation')}
        </Button>

        {geoError && (
          <p className="mt-3 text-sm text-nope">
            {t(geoError === 'denied' ? 'filters.locationDenied' : 'filters.locationUnavailable')}
          </p>
        )}

        <div className="mt-4">
          <label htmlFor="city" className="text-sm font-medium text-ink-muted">
            {t('filters.searchCity')}
          </label>
          <input
            id="city"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('filters.searchCityPlaceholder')}
            className="mt-2 w-full rounded-2xl bg-surface-sunk px-4 py-3 text-base outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
          />
          {searching && (
            <p className="mt-2 text-sm text-ink-faint">{t('filters.searching')}</p>
          )}
          {!searching && query.trim().length >= 2 && suggestions.length === 0 && (
            <p className="mt-2 text-sm text-ink-faint">{t('filters.noPlaces')}</p>
          )}
          {suggestions.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-2xl ring-1 ring-line">
              {suggestions.map((suggestion) => (
                <li key={`${suggestion.label}-${suggestion.point.lat}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocation(suggestion.point, suggestion.label)
                      setSuggestions([])
                      setQuery('')
                      setGeoError(null)
                    }}
                    className="w-full bg-surface px-4 py-3 text-left text-sm transition hover:bg-surface-sunk"
                  >
                    {suggestion.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-2 pb-4 pt-6">
        {location && (
          <p className="text-center text-sm text-ink-muted">
            {t('filters.locationSet', {
              place: locationLabel ?? t('filters.useLocation'),
            })}
          </p>
        )}
        <Button onClick={proceed} disabled={!location} full>
          {location ? t('common.continue') : t('filters.needLocation')}
        </Button>
      </div>
    </Screen>
  )
}
