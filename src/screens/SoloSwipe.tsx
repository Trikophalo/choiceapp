import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Card, SwipeDirection } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { useSoloStore } from '@/store/useSoloStore'
import { useDeck } from '@/hooks/useDeck'
import { CardStack } from '@/components/CardStack'
import { BackLink, Button, EmptyState, Screen, Spinner } from '@/components/ui'
import { CATEGORY_EMOJI } from '@/providers'
import { currentLocale } from '@/i18n'

const DECK_SIZE = 25

export function SoloSwipe() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { category, radiusM, location } = useAppStore()
  const { begin, like, pass, deck, index, winner, exhausted, reset } = useSoloStore()

  // A fresh seed per mount means "go again" deals a genuinely different deck.
  const [seed, setSeed] = useState(() => crypto.randomUUID())

  const { cards, loading, error, reload } = useDeck(category, {
    locale: currentLocale(),
    size: DECK_SIZE,
    seed,
    location: location ?? undefined,
    radiusM,
  })

  useEffect(() => {
    if (cards) begin(category, cards)
  }, [cards, category, begin])

  // Solo rule: the first right swipe ends the round immediately.
  useEffect(() => {
    if (winner) navigate('/result', { replace: true })
  }, [winner, navigate])

  const handleSwipe = (card: Card, direction: SwipeDirection) => {
    if (direction === 'like') like(card)
    else pass()
  }

  const startOver = () => {
    reset()
    setSeed(crypto.randomUUID())
  }

  const header = useMemo(
    () => (
      <div className="flex items-center justify-between py-3">
        <BackLink to="/" label={t('common.back')} />
        <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
          <span aria-hidden="true">{CATEGORY_EMOJI[category]}</span>
          {t(`categories.${category}`)}
        </div>
      </div>
    ),
    [category, t],
  )

  if (loading) {
    return (
      <Screen>
        {header}
        <div className="flex flex-1 items-center justify-center">
          <Spinner label={t('swipe.loadingDeck')} />
        </div>
      </Screen>
    )
  }

  if (error) {
    return (
      <Screen>
        {header}
        <EmptyState
          emoji="📡"
          title={t('swipe.errorTitle')}
          body={t('swipe.errorBody')}
          action={<Button onClick={reload}>{t('common.retry')}</Button>}
        />
      </Screen>
    )
  }

  if (!deck.length) {
    const isRestaurants = category === 'restaurants'
    return (
      <Screen>
        {header}
        <EmptyState
          emoji={isRestaurants ? '🗺️' : '🤷'}
          title={t(isRestaurants ? 'swipe.noRestaurantsTitle' : 'swipe.emptyTitle')}
          body={
            isRestaurants
              ? t('swipe.noRestaurantsBody', { km: (radiusM / 1000).toFixed(1) })
              : t('swipe.emptyBody')
          }
          action={
            <>
              {isRestaurants && (
                <Button onClick={() => navigate('/setup?mode=solo')}>
                  {t('filters.title')}
                </Button>
              )}
              <Button variant="secondary" onClick={reload}>
                {t('common.retry')}
              </Button>
            </>
          }
        />
      </Screen>
    )
  }

  if (exhausted) {
    return (
      <Screen>
        {header}
        <EmptyState
          emoji="🃏"
          title={t('result.noMatchTitle')}
          body={t('result.noMatchSoloBody')}
          action={
            <>
              <Button onClick={startOver}>{t('result.again')}</Button>
              <Button variant="secondary" onClick={() => navigate('/')}>
                {t('result.newCategory')}
              </Button>
            </>
          }
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {header}
      <CardStack cards={deck} index={index} onSwipe={handleSwipe} />
      <p className="pb-3 pt-5 text-center text-sm text-ink-faint">
        {t('swipe.progress', { current: Math.min(index + 1, deck.length), total: deck.length })}
      </p>
    </Screen>
  )
}
