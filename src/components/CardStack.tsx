import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Card, SwipeDirection } from '@/types'
import { SwipeCard } from './SwipeCard'
import { CardDetails } from './CardDetails'
import { tapFeedback } from '@/lib/haptics'

interface CardStackProps {
  cards: Card[]
  index: number
  onSwipe: (card: Card, direction: SwipeDirection) => void
}

/** Renders the top three cards and owns the button/keyboard swipe triggers. */
export function CardStack({ cards, index, onSwipe }: CardStackProps) {
  const { t } = useTranslation()
  // The trigger names the card it applies to. Without that binding, the card
  // promoted to the top can inherit the previous card's trigger and fly out
  // immediately, swiping two cards on one tap.
  const [triggered, setTriggered] = useState<{
    cardId: string
    direction: SwipeDirection
  } | null>(null)
  const [detailCard, setDetailCard] = useState<Card | null>(null)
  const top = cards[index]

  const trigger = useCallback(
    (direction: SwipeDirection) => {
      if (!top || triggered || detailCard) return
      tapFeedback(direction === 'like' ? [12, 40, 12] : 10)
      setTriggered({ cardId: top.id, direction })
    },
    [top, triggered, detailCard],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') trigger('nope')
      if (event.key === 'ArrowRight') trigger('like')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [trigger])

  const handleSwipe = (card: Card, direction: SwipeDirection) => {
    setTriggered(null)
    onSwipe(card, direction)
  }

  const visible = cards.slice(index, index + 3)

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-5 py-2">
      <div className="relative w-full max-w-[380px] flex-1 min-h-[360px] max-h-[620px] sm:max-w-[400px]">
        {visible.map((card, offset) => (
          <SwipeCard
            key={card.id}
            card={card}
            depth={offset}
            isTop={offset === 0}
            triggered={
              triggered?.cardId === card.id ? triggered.direction : null
            }
            onSwipe={(direction) => handleSwipe(card, direction)}
            onOpenDetails={() => setDetailCard(card)}
            labels={{
              like: t('swipe.like'),
              nope: t('swipe.nope'),
              details: t('details.open', { title: card.title }),
              stock: t('swipe.stockBadge'),
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => trigger('nope')}
          aria-label={t('swipe.nopeAria', { title: top?.title ?? '' })}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-nope shadow-soft ring-1 ring-line transition active:scale-95 hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => trigger('like')}
          aria-label={t('swipe.likeAria', { title: top?.title ?? '' })}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-sunset text-white shadow-card transition active:scale-95 hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="currentColor">
            <path d="M12 20.5l-1.4-1.26C5.7 14.9 2.8 12.3 2.8 9.1 2.8 6.6 4.8 4.6 7.3 4.6c1.4 0 2.8.66 3.7 1.7.9-1.04 2.3-1.7 3.7-1.7 2.5 0 4.5 2 4.5 4.5 0 3.2-2.9 5.8-7.8 10.14L12 20.5z" />
          </svg>
        </button>
      </div>

      <p className="text-center text-sm text-ink-faint">
        <span className="sm:hidden">{t('details.hint')}</span>
        <span className="hidden sm:inline">
          {t('details.hint')} · {t('swipe.keyboardHint')}
        </span>
      </p>

      <CardDetails card={detailCard} onClose={() => setDetailCard(null)} />
    </div>
  )
}
