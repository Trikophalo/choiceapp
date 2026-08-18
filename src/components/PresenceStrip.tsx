import { useTranslation } from 'react-i18next'
import type { Participant } from '@/types'

interface PresenceStripProps {
  participants: Record<string, Participant>
  selfUid: string | null
  hostId: string
  deckSize: number
}

/** Slim live strip: who is here, how far they've got, who dropped off. */
export function PresenceStrip({
  participants,
  selfUid,
  hostId,
  deckSize,
}: PresenceStripProps) {
  const { t } = useTranslation()
  const entries = Object.entries(participants).sort(
    ([, a], [, b]) => a.joinedAt - b.joinedAt,
  )

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {entries.map(([uid, participant]) => {
        const ratio = deckSize > 0 ? Math.min(participant.progress / deckSize, 1) : 0
        return (
          <li
            key={uid}
            className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 ring-1 transition ${
              participant.online
                ? 'bg-surface ring-line'
                : 'bg-surface-sunk opacity-55 ring-transparent'
            }`}
          >
            <span
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-surface-sunk text-base"
              // Conic ring doubles as a progress indicator.
              style={{
                backgroundImage: `conic-gradient(var(--accent) ${ratio * 360}deg, transparent 0deg)`,
              }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface">
                {participant.emoji}
              </span>
            </span>
            <span className="text-sm font-medium">
              {participant.name}
              {uid === selfUid && (
                <span className="ml-1 text-ink-faint">({t('group.youLabel')})</span>
              )}
              {uid === hostId && uid !== selfUid && (
                <span className="ml-1 text-ink-faint">({t('group.hostLabel')})</span>
              )}
            </span>
            {participant.done && (
              <span className="text-xs font-medium text-like">
                {t('group.swipedAll')}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
