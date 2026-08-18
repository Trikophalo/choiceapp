import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { Card } from '@/types'
import { CardArt } from './CardArt'

/** Keys rendered as long prose rather than a label/value row. */
const PROSE_KEYS = ['instructions', 'overview', 'summary']

interface CardDetailsProps {
  card: Card | null
  onClose: () => void
}

/**
 * Full detail sheet for a card — the synopsis of a film, the method and
 * ingredients of a dish, the address of a restaurant. Opens on tap so the
 * swipe decision can be an informed one, and closes without ever counting as
 * a swipe.
 */
export function CardDetails({ card, onClose }: CardDetailsProps) {
  const { t } = useTranslation()
  const closeRef = useRef<HTMLButtonElement>(null)

  // Escape closes; focus moves into the sheet so the keyboard path works too.
  useEffect(() => {
    if (!card) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    closeRef.current?.focus()
    // The sheet scrolls; the page behind it must not.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = previous
    }
  }, [card, onClose])

  const rows = Object.entries(card?.meta ?? {}).filter(
    ([key]) => !PROSE_KEYS.includes(key),
  )
  const prose = PROSE_KEYS.map((key) => card?.meta?.[key]).filter(
    (text): text is string => Boolean(text),
  )

  // The subtitle is often a truncated form of the long text (providers derive
  // both from one description). Printing both reads as a stutter.
  const subtitleIsPreviewOfProse =
    card?.subtitle != null &&
    prose.some((text) =>
      text.startsWith(card.subtitle!.replace(/…$/, '').trim().slice(0, 40)),
    )

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={card.title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-bg-elevated shadow-card sm:max-h-[85dvh] sm:rounded-[2rem]"
          >
            <div className="relative h-52 shrink-0">
              <CardArt
                src={card.imageUrl}
                title={card.title}
                seed={card.accentSeed}
                className="h-full w-full"
                eager
              />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent" />
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <h2 className="absolute inset-x-0 bottom-0 p-5 text-2xl font-semibold leading-tight tracking-tight text-white">
                {card.title}
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
              {card.imageIsStock && (
                <p className="mb-3 text-xs text-ink-faint">
                  {t('details.stockPhoto')}
                </p>
              )}

              {card.subtitle && !subtitleIsPreviewOfProse && (
                <p className="leading-relaxed text-ink-muted">{card.subtitle}</p>
              )}

              {prose.map((text, index) => (
                <p key={index} className="mt-4 leading-relaxed whitespace-pre-line">
                  {text}
                </p>
              ))}

              {rows.length > 0 && (
                <dl className="mt-5 divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
                  {rows.map(([key, value]) => (
                    <div key={key} className="flex gap-4 px-4 py-3 text-sm">
                      <dt className="w-28 shrink-0 text-ink-muted">
                        {t(`meta.${key}`, { defaultValue: key })}
                      </dt>
                      <dd className="flex-1 break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {card.sourceUrl && (
                <a
                  href={card.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl bg-surface px-6 text-base font-medium ring-1 ring-line transition hover:bg-surface-sunk"
                >
                  {t('result.openLink')}
                </a>
              )}
            </div>

            <div className="shrink-0 border-t border-line p-4 safe-bottom">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[3rem] w-full rounded-2xl bg-gradient-sunset text-base font-medium text-white transition active:scale-[0.99]"
              >
                {t('details.backToSwiping')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
