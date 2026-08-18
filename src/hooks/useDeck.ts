import { useCallback, useEffect, useRef, useState } from 'react'
import type { Card, CategoryId, DeckOptions } from '@/types'
import { getProvider } from '@/providers'

interface UseDeckResult {
  cards: Card[] | null
  loading: boolean
  error: Error | null
  reload: () => void
}

/** Fetches a deck for a category, cancelling in-flight work on unmount or when
 *  the inputs change. */
export function useDeck(
  category: CategoryId | null,
  options: Omit<DeckOptions, 'signal'>,
  enabled = true,
): UseDeckResult {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  // Keep the options object out of the effect deps: its identity changes every
  // render, while only the primitive values below should force a refetch.
  const optionsRef = useRef(options)
  optionsRef.current = options

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const { locale, size, seed, radiusM } = options
  const locationKey = options.location
    ? `${options.location.lat.toFixed(4)},${options.location.lng.toFixed(4)}`
    : ''

  useEffect(() => {
    if (!category || !enabled) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    getProvider(category)
      .fetchDeck({ ...optionsRef.current, signal: controller.signal })
      .then((deck) => {
        if (controller.signal.aborted) return
        setCards(deck)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [category, enabled, locale, size, seed, radiusM, locationKey, nonce])

  return { cards, loading, error, reload }
}
