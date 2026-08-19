import type { Card, SessionState } from '@/types'
import { MAX_ROUNDS } from '@/lib/match'
import type { CreateSessionInput, JoinInput, SyncAdapter } from './types'

/**
 * Same-device sync adapter: session state lives in localStorage (shared by
 * every tab) while each tab gets its OWN identity from sessionStorage. That
 * split is what makes the demo genuinely playable — two tabs act as two
 * separate participants, so a real group round can be run on one machine with
 * no backend, no signup and no keys. The UI labels this clearly as demo sync
 * so nobody expects the link to reach another phone.
 *
 * sessionStorage also survives a reload of the same tab, which preserves the
 * rejoin-after-refresh behaviour the Firebase adapter gets from its persistent
 * anonymous uid.
 */
const STORAGE_PREFIX = 'swipedecide.session.'
const UID_KEY = 'swipedecide.uid'
const CHANNEL = 'swipedecide.sync'

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`
}

function readSession(sessionId: string): SessionState | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId))
    return raw ? (JSON.parse(raw) as SessionState) : null
  } catch {
    return null
  }
}

/** In-process listeners for this tab. BroadcastChannel and `storage` events
 *  deliberately do NOT fire in the tab that performed the write, so without
 *  this registry a tab would never observe its own changes. */
const localListeners = new Map<string, Set<() => void>>()

function notifyLocal(sessionId: string): void {
  localListeners.get(sessionId)?.forEach((listener) => listener())
}

function writeSession(sessionId: string, session: SessionState): void {
  localStorage.setItem(storageKey(sessionId), JSON.stringify(session))
  notifyLocal(sessionId)
  channel?.postMessage({ sessionId })
}

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null

/** Read-modify-write. Same-thread and cross-tab writes are serialised by the
 *  event loop, so no locking is needed at this scale. */
function mutate(
  sessionId: string,
  fn: (session: SessionState) => SessionState | null,
): SessionState | null {
  const current = readSession(sessionId)
  if (!current) return null
  const next = fn(current)
  if (next) writeSession(sessionId, next)
  return next
}

export class LocalSync implements SyncAdapter {
  readonly kind = 'local' as const
  readonly isCrossDevice = false
  private uid: string | null = null

  async signIn(): Promise<string> {
    if (this.uid) return this.uid
    // Per-tab, not per-browser: each tab is its own participant.
    let stored = sessionStorage.getItem(UID_KEY)
    if (!stored) {
      stored = `local-${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(UID_KEY, stored)
    }
    this.uid = stored
    return stored
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    const uid = await this.signIn()
    const now = Date.now()
    writeSession(input.sessionId, {
      meta: {
        v: 1,
        category: input.category,
        status: 'lobby',
        hostId: uid,
        createdAt: now,
        startedAt: null,
        locale: input.locale,
        filters: input.filters,
      },
      deck: [],
      participants: {
        [uid]: {
          name: input.host.name,
          emoji: input.host.emoji,
          joinedAt: now,
          online: true,
          progress: 0,
          done: false,
        },
      },
      likes: {},
      winner: null,
    })
  }

  async join(input: JoinInput): Promise<void> {
    const uid = await this.signIn()
    mutate(input.sessionId, (session) => {
      // Participants freeze at round start; a late arrival watches instead.
      if (session.meta.status !== 'lobby' && !session.participants[uid]) {
        return null
      }
      return {
        ...session,
        participants: {
          ...session.participants,
          [uid]: {
            name: input.name,
            emoji: input.emoji,
            joinedAt: session.participants[uid]?.joinedAt ?? Date.now(),
            online: true,
            progress: session.participants[uid]?.progress ?? 0,
            done: session.participants[uid]?.done ?? false,
          },
        },
      }
    })
  }

  subscribe(
    sessionId: string,
    onChange: (session: SessionState | null) => void,
  ): () => void {
    const emit = () => onChange(readSession(sessionId))

    const onMessage = (event: MessageEvent<{ sessionId: string }>) => {
      if (event.data?.sessionId === sessionId) emit()
    }
    // `storage` covers tabs that miss the BroadcastChannel message.
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(sessionId)) emit()
    }

    const listeners = localListeners.get(sessionId) ?? new Set<() => void>()
    listeners.add(emit)
    localListeners.set(sessionId, listeners)

    channel?.addEventListener('message', onMessage)
    window.addEventListener('storage', onStorage)
    emit()

    return () => {
      listeners.delete(emit)
      if (listeners.size === 0) localListeners.delete(sessionId)
      channel?.removeEventListener('message', onMessage)
      window.removeEventListener('storage', onStorage)
    }
  }

  async startRound(sessionId: string, deck: Card[]): Promise<void> {
    mutate(sessionId, (session) => ({
      ...session,
      deck,
      meta: { ...session.meta, status: 'active', startedAt: Date.now() },
    }))
  }

  async like(sessionId: string, cardId: string): Promise<void> {
    const uid = await this.signIn()
    mutate(sessionId, (session) => ({
      ...session,
      likes: {
        ...session.likes,
        [cardId]: { ...(session.likes[cardId] ?? {}), [uid]: true },
      },
    }))
  }

  async setProgress(
    sessionId: string,
    progress: number,
    done: boolean,
  ): Promise<void> {
    const uid = await this.signIn()
    mutate(sessionId, (session) => {
      const participant = session.participants[uid]
      if (!participant) return null
      return {
        ...session,
        participants: {
          ...session.participants,
          [uid]: { ...participant, progress, done },
        },
      }
    })
  }

  async claimWinner(sessionId: string, cardId: string): Promise<boolean> {
    const uid = await this.signIn()
    let claimed = false
    mutate(sessionId, (session) => {
      if (session.winner) return null // Someone already won the race.
      claimed = true
      return {
        ...session,
        winner: { cardId, decidedAt: Date.now(), byUid: uid },
        meta: { ...session.meta, status: 'matched' },
      }
    })
    return claimed
  }

  async redeal(
    sessionId: string,
    deck: Card[],
    nextRound: number,
    seenIds: string[],
  ): Promise<void> {
    mutate(sessionId, (session) => {
      if (session.winner) return null
      if (!deck.length) {
        // Nothing unseen left: finalise at the cap, stay exhausted.
        return {
          ...session,
          meta: { ...session.meta, round: MAX_ROUNDS, seenIds },
        }
      }
      const participants = Object.fromEntries(
        Object.entries(session.participants).map(([uid, participant]) => [
          uid,
          { ...participant, progress: 0, done: false },
        ]),
      )
      return {
        ...session,
        deck,
        likes: {},
        participants,
        meta: {
          ...session.meta,
          status: 'active',
          round: nextRound,
          seenIds,
        },
      }
    })
  }

  async markExhausted(sessionId: string): Promise<void> {
    mutate(sessionId, (session) => {
      if (session.winner) return null
      return { ...session, meta: { ...session.meta, status: 'exhausted' } }
    })
  }
}
