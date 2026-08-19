import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Card, SwipeDirection } from '@/types'
import { useSession } from '@/hooks/useSession'
import { useDeck } from '@/hooks/useDeck'
import { getSync } from '@/sync'
import { useAppStore } from '@/store/useAppStore'
import {
  MAX_ROUNDS,
  findUnanimousCardId,
  isExhausted,
  rankByLikes,
  stillSwiping,
} from '@/lib/match'
import { getProvider } from '@/providers'
import { CardStack } from '@/components/CardStack'
import { PresenceStrip } from '@/components/PresenceStrip'
import { IdentityForm } from '@/components/IdentityForm'
import { ResultView } from './Result'
import { BackLink, Button, EmptyState, Screen, Spinner } from '@/components/ui'
import { CardArt } from '@/components/CardArt'
import { currentLocale } from '@/i18n'

const DECK_SIZE = 25
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

/**
 * One screen drives the whole group round: join → lobby → swipe → reveal.
 * Everything is derived from the synced session, so every device renders the
 * same phase without any local phase state to drift.
 */
export function GroupSession() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const sync = useMemo(() => getSync(), [])
  const { session, uid, loading } = useSession(sessionId)
  const { displayName, emoji, setIdentity, radiusM, location } = useAppStore()

  const [joining, setJoining] = useState(false)
  const [localIndex, setLocalIndex] = useState(0)
  const claimAttempted = useRef<string | null>(null)
  const redealStarted = useRef<number>(0)

  const isParticipant = Boolean(uid && session?.participants?.[uid])
  const isHost = Boolean(uid && session?.meta.hostId === uid)
  const status = session?.meta.status
  const round = session?.meta.round ?? 1
  const expired =
    session != null && Date.now() - session.meta.createdAt > SESSION_TTL_MS

  /* ---- Host deck fetch: only the host calls the content APIs, once. ---- */
  const shouldFetchDeck = Boolean(isHost && status === 'lobby' && session)
  const { cards: hostDeck, loading: deckLoading } = useDeck(
    session?.meta.category ?? null,
    {
      locale: session?.meta.locale ?? currentLocale(),
      size: DECK_SIZE,
      seed: sessionId ?? 'seed',
      location: location ?? undefined,
      radiusM: session?.meta.filters?.radiusM ?? radiusM,
    },
    shouldFetchDeck,
  )

  /* ---- Restore swipe position after a refresh. ---- */
  useEffect(() => {
    if (!uid || !session) return
    const progress = session.participants[uid]?.progress
    if (typeof progress === 'number' && progress > localIndex) {
      setLocalIndex(progress)
    }
    // Only re-sync when the round starts or the participant record appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, session?.meta.status])

  /* ---- A redeal arrived: everyone starts the new deck from the top. ---- */
  useEffect(() => {
    if (round > 1) {
      setLocalIndex(0)
      claimAttempted.current = null
    }
  }, [round])

  /* ---- Automatic redeal: the host deals a fresh deck with unseen cards
     when everyone finished without a unanimous like, up to MAX_ROUNDS. ---- */
  useEffect(() => {
    if (!session || !sessionId || !isHost) return
    if (status !== 'exhausted' || session.winner) return
    if (round >= MAX_ROUNDS) return
    if (redealStarted.current >= round + 1) return // Already dealing this one.
    redealStarted.current = round + 1

    const controller = new AbortController()
    const seenSoFar = [
      ...(session.meta.seenIds ?? []),
      ...session.deck.map((card) => card.id),
    ]

    void getProvider(session.meta.category)
      .fetchDeck({
        locale: session.meta.locale ?? currentLocale(),
        size: DECK_SIZE,
        seed: `${sessionId}:r${round + 1}`,
        location: location ?? undefined,
        radiusM: session.meta.filters?.radiusM ?? radiusM,
        excludeIds: seenSoFar,
        signal: controller.signal,
      })
      .catch(() => [] as never[])
      .then((deck) => {
        if (controller.signal.aborted) return
        // An empty deck finalises at the cap inside the adapter.
        return sync.redeal(sessionId, deck, round + 1, seenSoFar)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, round, isHost, sessionId])

  /* ---- Winner detection: run by whoever's like completed unanimity. ---- */
  useEffect(() => {
    if (!session || !sessionId || status !== 'active' || session.winner) return

    const participantIds = Object.keys(session.participants)
    const candidate = findUnanimousCardId(
      session.deck,
      session.likes,
      participantIds,
    )

    if (candidate && claimAttempted.current !== candidate) {
      claimAttempted.current = candidate
      // Write-once claim; exactly one client's claim commits.
      void sync.claimWinner(sessionId, candidate)
      return
    }

    if (!candidate && isExhausted(session)) {
      void sync.markExhausted(sessionId)
    }
  }, [session, sessionId, status, sync])

  const handleSwipe = useCallback(
    async (card: Card, direction: SwipeDirection) => {
      if (!sessionId) return
      const next = localIndex + 1
      setLocalIndex(next)

      const total = session?.deck.length ?? 0
      if (direction === 'like') await sync.like(sessionId, card.id)
      await sync.setProgress(sessionId, next, next >= total)
    },
    [sessionId, localIndex, session?.deck.length, sync],
  )

  /* ---------------- Render states ---------------- */

  if (loading) {
    return (
      <Screen>
        <div className="flex flex-1 items-center justify-center">
          <Spinner label={t('app.loading')} />
        </div>
      </Screen>
    )
  }

  if (!session) {
    // Without a sync backend a session lives only in the browser that created
    // it, so a guest on another device finds nothing. Say that plainly instead
    // of blaming the link, which is the one thing that is not wrong.
    const noBackend = !sync.isCrossDevice
    return (
      <Screen>
        <EmptyState
          emoji={noBackend ? '📵' : '🔍'}
          title={t(noBackend ? 'group.noBackendTitle' : 'group.notFoundTitle')}
          body={t(noBackend ? 'group.noBackendBody' : 'group.notFoundBody')}
          action={<Button onClick={() => navigate('/')}>{t('group.backHome')}</Button>}
        />
      </Screen>
    )
  }

  if (expired && status !== 'matched') {
    return (
      <Screen>
        <EmptyState
          emoji="⌛"
          title={t('group.expiredTitle')}
          body={t('group.expiredBody')}
          action={<Button onClick={() => navigate('/')}>{t('group.backHome')}</Button>}
        />
      </Screen>
    )
  }

  // Winner: everyone lands here the moment the claim commits.
  if (session.winner) {
    const card = session.deck.find((c) => c.id === session.winner?.cardId)
    if (card) {
      return (
        <ResultView
          card={card}
          title={t('result.groupTitle')}
          subtitle={t('result.groupSubtitle')}
        />
      )
    }
  }

  if (status === 'exhausted') {
    const hostOnline = session.participants[session.meta.hostId]?.online
    // While the host can still deal a fresh round, show the transition rather
    // than the dead-end screen. A gone host can't redeal — final result then.
    if (round < MAX_ROUNDS && hostOnline) {
      return (
        <Screen>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Spinner />
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {t('group.redealTitle')}
            </h1>
            <p className="mt-2 max-w-xs text-ink-muted">
              {t('group.redealBody')}
            </p>
            <p className="mt-4 text-sm font-medium text-accent">
              {t('group.roundOf', { round: round + 1, max: MAX_ROUNDS })}
            </p>
          </div>
        </Screen>
      )
    }
    return <NoMatch session={session} />
  }

  // Not a participant yet.
  if (!isParticipant) {
    // Participants freeze at round start; a late arrival can only watch.
    if (status !== 'lobby') {
      return (
        <Screen>
          <EmptyState
            emoji="👀"
            title={t('group.inProgressTitle')}
            body={t('group.inProgressBody')}
            action={
              <Button variant="secondary" disabled>
                {t('group.watchResult')}
              </Button>
            }
          />
        </Screen>
      )
    }
    return (
      <IdentityForm
        title={t('group.joinTitle')}
        body={t('group.joinBody')}
        submitLabel={joining ? t('group.joining') : t('group.join')}
        initialName={displayName}
        initialEmoji={emoji}
        busy={joining}
        onSubmit={(name, chosenEmoji) => {
          setIdentity(name, chosenEmoji)
          setJoining(true)
          void sync
            .join({ sessionId: sessionId!, name, emoji: chosenEmoji })
            .finally(() => setJoining(false))
        }}
      />
    )
  }

  if (status === 'lobby') {
    return (
      <Lobby
        session={session}
        sessionId={sessionId!}
        uid={uid}
        isHost={isHost}
        deckReady={Boolean(hostDeck?.length)}
        deckLoading={deckLoading}
        onStart={async () => {
          if (hostDeck?.length) await sync.startRound(sessionId!, hostDeck)
        }}
      />
    )
  }

  /* ---- Active round ---- */
  const deck = session.deck
  const done = localIndex >= deck.length
  const waitingOn = uid ? stillSwiping(session.participants, uid) : []

  return (
    <Screen>
      <div className="flex items-center justify-between py-3">
        <BackLink to="/" label={t('common.back')} />
        <span className="text-sm font-medium text-ink-muted">
          {round > 1 && (
            <span className="mr-2 rounded-full bg-surface-sunk px-2 py-0.5 text-xs text-accent">
              {t('group.roundOf', { round, max: MAX_ROUNDS })}
            </span>
          )}
          {t(`categories.${session.meta.category}`)}
        </span>
      </div>

      <div className="pb-3">
        <PresenceStrip
          participants={session.participants}
          selfUid={uid}
          hostId={session.meta.hostId}
          deckSize={deck.length}
        />
      </div>

      {done ? (
        <EmptyState
          emoji="⏳"
          title={t('group.doneTitle')}
          body={
            waitingOn.length
              ? t('group.doneBody', {
                  names: waitingOn.map((p) => `${p.emoji} ${p.name}`).join(', '),
                })
              : t('group.doneBodyGeneric')
          }
          action={
            isHost ? (
              <Button
                variant="secondary"
                onClick={() => {
                  if (window.confirm(t('group.endRoundConfirm'))) {
                    void sync.markExhausted(sessionId!)
                  }
                }}
              >
                {t('group.endRound')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <CardStack cards={deck} index={localIndex} onSwipe={handleSwipe} />
          <p className="pb-3 pt-5 text-center text-sm text-ink-faint">
            {t('swipe.progress', {
              current: Math.min(localIndex + 1, deck.length),
              total: deck.length,
            })}
          </p>
        </>
      )}
    </Screen>
  )
}

/* ---------------- Lobby ---------------- */

function Lobby({
  session,
  sessionId,
  uid,
  isHost,
  deckReady,
  deckLoading,
  onStart,
}: {
  session: import('@/types').SessionState
  sessionId: string
  uid: string | null
  isHost: boolean
  deckReady: boolean
  deckLoading: boolean
  onStart: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)
  const sync = useMemo(() => getSync(), [])

  const link = `${window.location.origin}${import.meta.env.BASE_URL}#/s/${sessionId}`
  const count = Object.keys(session.participants).length

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure context or permission) — the input below
      // still lets the user select and copy manually.
    }
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t('app.name'), url: link })
        return
      } catch {
        // Sheet dismissed.
      }
    }
    await copy()
  }

  return (
    <Screen>
      <div className="py-3">
        <BackLink to="/" label={t('common.back')} />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">
        {t('group.lobbyTitle')}
      </h1>
      <p className="mt-2 text-ink-muted">{t('group.lobbyBody')}</p>

      {sync.isCrossDevice && (
        // Positive confirmation: with Firebase configured, the shared link
        // genuinely works on other devices — say so instead of leaving the
        // absence of a warning to speak for itself.
        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-surface-sunk p-3.5 text-sm font-medium text-like">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {t('group.liveSync')}
        </div>
      )}

      {!sync.isCrossDevice && (
        // Warn before the link is sent, not after a friend hits a dead end.
        // Styled as a warning rather than a note because sharing this link with
        // someone on another phone simply will not work.
        <div className="mt-5 rounded-2xl border-l-4 border-nope bg-surface-sunk p-4">
          <p className="text-sm font-semibold text-nope">
            ⚠️ {t('group.demoNoticeTitle')}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            {t('group.demoNoticeBody')}
          </p>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t('group.copyLink')}
          className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 text-sm text-ink-muted outline-none ring-1 ring-line"
        />
        <Button onClick={share} className="shrink-0 px-5">
          {copied ? t('group.linkCopied') : t('common.share')}
        </Button>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          {t('group.participants')} · {count}
        </h2>
        <div className="mt-3">
          <PresenceStrip
            participants={session.participants}
            selfUid={uid}
            hostId={session.meta.hostId}
            deckSize={0}
          />
        </div>
        {count === 1 && (
          <p className="mt-4 text-sm text-ink-muted">{t('group.alone')}</p>
        )}
      </section>

      <div className="mt-auto pb-4 pt-8">
        {isHost ? (
          <>
            <Button
              onClick={async () => {
                setStarting(true)
                try {
                  await onStart()
                } finally {
                  setStarting(false)
                }
              }}
              disabled={!deckReady || starting}
              full
            >
              {deckLoading || starting
                ? t('group.startingRound')
                : t('group.startRound')}
            </Button>
            <p className="mt-3 text-center text-xs text-ink-faint">
              {t('group.startRoundHint')}
            </p>
          </>
        ) : (
          <div className="text-center">
            <Spinner label={t('group.waitingTitle')} />
            <p className="text-sm text-ink-muted">
              {t('group.waitingBody', {
                host: session.participants[session.meta.hostId]?.name ?? '—',
              })}
            </p>
          </div>
        )}
      </div>
    </Screen>
  )
}

/* ---------------- No match ---------------- */

function NoMatch({ session }: { session: import('@/types').SessionState }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ranked = rankByLikes(session.deck, session.likes).slice(0, 5)

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="text-center">
          <div className="text-6xl" aria-hidden="true">🤔</div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {t('result.noMatchTitle')}
          </h1>
          <p className="mt-2 text-ink-muted">{t('result.noMatchBody')}</p>
        </div>

        {ranked.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
              {t('result.mostLiked')}
            </h2>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
              {ranked.map(({ card, count }) => (
                <li key={card.id} className="flex items-center gap-3 p-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                    <CardArt
                      src={card.imageUrl}
                      title={card.title}
                      seed={card.accentSeed}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{card.title}</div>
                    <div className="text-sm text-ink-muted">
                      {t('result.likeCount', { count })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="pb-4">
        <Button onClick={() => navigate('/')} full>
          {t('result.newCategory')}
        </Button>
      </div>
    </Screen>
  )
}
