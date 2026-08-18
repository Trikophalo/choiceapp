import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Card } from '@/types'
import { useSoloStore } from '@/store/useSoloStore'
import { CardArt } from '@/components/CardArt'
import { Button, Screen } from '@/components/ui'
import { Confetti } from '@/components/Confetti'

interface ResultViewProps {
  card: Card
  title: string
  subtitle: string
  onAgain?: () => void
  againLabel?: string
}

/** Shared reveal used by both solo and group rounds. */
export function ResultView({ card, title, subtitle, onAgain, againLabel }: ResultViewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const isPlace = card.id.startsWith('osm:') || card.id.startsWith('gplaces:')
  const details = useMemo(
    () =>
      Object.entries(card.meta ?? {}).filter(
        ([key]) => key !== 'instructions' && key !== 'overview' && key !== 'summary',
      ),
    [card.meta],
  )
  const longText =
    card.meta?.instructions ?? card.meta?.overview ?? card.meta?.summary
  // Avoid printing the subtitle and a long text that merely extends it.
  const subtitleIsPreview =
    card.subtitle != null &&
    longText != null &&
    longText.startsWith(card.subtitle.replace(/…$/, '').trim().slice(0, 40))

  const share = async () => {
    const text = t('result.shareText', { title: card.title })
    if (navigator.share) {
      try {
        await navigator.share({ text, url: card.sourceUrl })
        return
      } catch {
        // User dismissed the sheet — fall through to the clipboard.
      }
    }
    await navigator.clipboard?.writeText(`${text}${card.sourceUrl ? ` — ${card.sourceUrl}` : ''}`)
  }

  return (
    <Screen>
      <Confetti />
      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          {title}
        </p>
        <h1 className="mt-2 text-center text-[2rem] font-semibold leading-tight tracking-tight">
          {card.title}
        </h1>
        <p className="mt-2 max-w-xs text-center text-sm text-ink-muted">{subtitle}</p>

        <div className="mt-6 aspect-[4/3] w-full max-w-[340px] overflow-hidden rounded-[var(--radius-card)] shadow-card">
          <CardArt
            src={card.imageUrl}
            title={card.title}
            seed={card.accentSeed}
            className="h-full w-full"
            eager
          />
        </div>

        {card.subtitle && !subtitleIsPreview && (
          <p className="mt-5 max-w-sm text-center leading-relaxed text-ink-muted">
            {card.subtitle}
          </p>
        )}

        {details.length > 0 && (
          <dl className="mt-5 w-full max-w-sm divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
            {details.map(([key, value]) => (
              <div key={key} className="flex gap-4 px-4 py-3 text-sm">
                <dt className="w-28 shrink-0 text-ink-muted">
                  {t(`meta.${key}`, { defaultValue: key })}
                </dt>
                <dd className="flex-1 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {longText && (
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
            {longText}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 pb-4 pt-2">
        {card.sourceUrl && (
          <Button
            onClick={() => window.open(card.sourceUrl, '_blank', 'noopener,noreferrer')}
            full
          >
            {isPlace ? t('result.directions') : t('result.openLink')}
          </Button>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={share} className="flex-1">
            {t('result.shareResult')}
          </Button>
          {onAgain && (
            <Button variant="secondary" onClick={onAgain} className="flex-1">
              {againLabel ?? t('result.again')}
            </Button>
          )}
        </div>
        <Button variant="ghost" onClick={() => navigate('/')} full>
          {t('result.newCategory')}
        </Button>
      </div>
    </Screen>
  )
}

export function SoloResult() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const winner = useSoloStore((s) => s.winner)
  const reset = useSoloStore((s) => s.reset)

  // Direct navigation to /result without a round in progress.
  useEffect(() => {
    if (!winner) navigate('/', { replace: true })
  }, [winner, navigate])

  if (!winner) return null

  return (
    <ResultView
      card={winner}
      title={t('result.soloTitle')}
      subtitle={t('result.soloSubtitle')}
      onAgain={() => {
        reset()
        navigate('/solo', { replace: true })
      }}
    />
  )
}
