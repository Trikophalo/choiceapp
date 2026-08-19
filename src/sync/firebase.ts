import type { Card, SessionState } from '@/types'
import { MAX_ROUNDS } from '@/lib/match'
import type { CreateSessionInput, JoinInput, SyncAdapter } from './types'
import { firebaseConfig } from './firebaseConfig'

/**
 * Firebase Realtime Database adapter.
 *
 * The session subtree IS the shared state machine: every client holds one
 * WebSocket subscription and writes only its own facts (its join, its likes,
 * its presence). Security comes from firebase/database.rules.json, not from
 * hiding the config — a Firebase web config is public by design.
 *
 * The SDK is imported dynamically so solo mode (and any deployment without
 * Firebase configured) never downloads it.
 */

type AuthModule = typeof import('firebase/auth')
type DbModule = typeof import('firebase/database')

interface Loaded {
  auth: import('firebase/auth').Auth
  db: import('firebase/database').Database
  authApi: AuthModule
  dbApi: DbModule
}

/** RTDB omits empty objects entirely, so every read needs defaults. */
function normalise(raw: unknown): SessionState | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<SessionState>
  if (!value.meta) return null
  return {
    meta: value.meta,
    deck: value.deck ?? [],
    participants: value.participants ?? {},
    likes: value.likes ?? {},
    winner: value.winner ?? null,
  }
}

/** RTDB keys cannot contain . $ # [ ] / — provider ids use slashes and dots. */
export function encodeCardId(cardId: string): string {
  return cardId.replace(/[.$#[\]/]/g, '_')
}

export class FirebaseSync implements SyncAdapter {
  readonly kind = 'firebase' as const
  readonly isCrossDevice = true

  private loaded: Promise<Loaded> | null = null
  private uid: string | null = null

  private load(): Promise<Loaded> {
    if (!this.loaded) {
      this.loaded = (async () => {
        const [appApi, authApi, dbApi] = await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/database'),
        ])
        const app = appApi.initializeApp(firebaseConfig)
        return {
          auth: authApi.getAuth(app),
          db: dbApi.getDatabase(app),
          authApi,
          dbApi,
        }
      })()
    }
    return this.loaded
  }

  async signIn(): Promise<string> {
    if (this.uid) return this.uid
    const { auth, authApi } = await this.load()

    // The anonymous uid persists per browser, which is what lets a refresh
    // rejoin as the same participant.
    if (auth.currentUser) {
      this.uid = auth.currentUser.uid
      return this.uid
    }
    const existing = await new Promise<string | null>((resolve) => {
      const stop = authApi.onAuthStateChanged(auth, (user) => {
        stop()
        resolve(user?.uid ?? null)
      })
    })
    if (existing) {
      this.uid = existing
      return existing
    }
    const credential = await authApi.signInAnonymously(auth)
    this.uid = credential.user.uid
    return this.uid
  }

  private path(sessionId: string, suffix = ''): string {
    return `sessions/${sessionId}${suffix}`
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    const uid = await this.signIn()
    const { db, dbApi } = await this.load()

    await dbApi.set(dbApi.ref(db, this.path(input.sessionId)), {
      meta: {
        v: 1,
        category: input.category,
        status: 'lobby',
        hostId: uid,
        createdAt: dbApi.serverTimestamp(),
        startedAt: null,
        locale: input.locale,
        ...(input.filters ? { filters: input.filters } : {}),
      },
      participants: {
        [uid]: {
          name: input.host.name,
          emoji: input.host.emoji,
          joinedAt: dbApi.serverTimestamp(),
          online: true,
          progress: 0,
          done: false,
        },
      },
    })
    await this.trackPresence(input.sessionId, uid)
  }

  async join(input: JoinInput): Promise<void> {
    const uid = await this.signIn()
    const { db, dbApi } = await this.load()

    await dbApi.update(
      dbApi.ref(db, this.path(input.sessionId, `/participants/${uid}`)),
      {
        name: input.name,
        emoji: input.emoji,
        joinedAt: dbApi.serverTimestamp(),
        online: true,
        progress: 0,
        done: false,
      },
    )
    await this.trackPresence(input.sessionId, uid)
  }

  /** Flips `online` to false server-side if the socket drops, so the group can
   *  see who left rather than waiting forever. */
  private async trackPresence(sessionId: string, uid: string): Promise<void> {
    const { db, dbApi } = await this.load()
    const onlineRef = dbApi.ref(
      db,
      this.path(sessionId, `/participants/${uid}/online`),
    )
    void dbApi.onDisconnect(onlineRef).set(false)
    await dbApi.set(onlineRef, true)
  }

  subscribe(
    sessionId: string,
    onChange: (session: SessionState | null) => void,
  ): () => void {
    let stop: (() => void) | null = null
    let cancelled = false

    void this.load().then(({ db, dbApi }) => {
      if (cancelled) return
      stop = dbApi.onValue(dbApi.ref(db, this.path(sessionId)), (snapshot) => {
        onChange(normalise(snapshot.val()))
      })
    })

    // Safe to call before the SDK finishes loading.
    return () => {
      cancelled = true
      stop?.()
    }
  }

  async startRound(sessionId: string, deck: Card[]): Promise<void> {
    const { db, dbApi } = await this.load()
    // Deck first, then status: a client must never see `active` without cards.
    await dbApi.set(dbApi.ref(db, this.path(sessionId, '/deck')), deck)
    await dbApi.update(dbApi.ref(db, this.path(sessionId, '/meta')), {
      status: 'active',
      startedAt: dbApi.serverTimestamp(),
    })
  }

  async like(sessionId: string, cardId: string): Promise<void> {
    const uid = await this.signIn()
    const { db, dbApi } = await this.load()
    await dbApi.set(
      dbApi.ref(
        db,
        this.path(sessionId, `/likes/${encodeCardId(cardId)}/${uid}`),
      ),
      true,
    )
  }

  async setProgress(
    sessionId: string,
    progress: number,
    done: boolean,
  ): Promise<void> {
    const uid = await this.signIn()
    const { db, dbApi } = await this.load()
    await dbApi.update(
      dbApi.ref(db, this.path(sessionId, `/participants/${uid}`)),
      { progress, done },
    )
  }

  async claimWinner(sessionId: string, cardId: string): Promise<boolean> {
    const uid = await this.signIn()
    const { db, dbApi } = await this.load()

    // Write-once transaction: exactly one claim commits, so two clients
    // completing different cards simultaneously still converge on one winner.
    const result = await dbApi.runTransaction(
      dbApi.ref(db, this.path(sessionId, '/winner')),
      (current) =>
        current === null
          ? { cardId, decidedAt: Date.now(), byUid: uid }
          : undefined, // `undefined` aborts the transaction.
    )

    if (result.committed) {
      await dbApi.update(dbApi.ref(db, this.path(sessionId, '/meta')), {
        status: 'matched',
      })
    }
    return result.committed
  }

  async redeal(
    sessionId: string,
    deck: Card[],
    nextRound: number,
    seenIds: string[],
  ): Promise<void> {
    const { db, dbApi } = await this.load()

    if (!deck.length) {
      await dbApi.update(dbApi.ref(db, this.path(sessionId, '/meta')), {
        round: MAX_ROUNDS,
        seenIds,
      })
      return
    }

    // One atomic multi-path update: guests can never observe a half-reset
    // round (new deck with old likes, or active status with stale progress).
    const current = await new Promise<SessionState | null>((resolve) => {
      const stop = dbApi.onValue(
        dbApi.ref(db, this.path(sessionId)),
        (snapshot) => {
          stop()
          resolve(normalise(snapshot.val()))
        },
        { onlyOnce: true },
      )
    })

    const updates: Record<string, unknown> = {
      deck,
      likes: null,
      'meta/status': 'active',
      'meta/round': nextRound,
      'meta/seenIds': seenIds,
    }
    for (const uid of Object.keys(current?.participants ?? {})) {
      updates[`participants/${uid}/progress`] = 0
      updates[`participants/${uid}/done`] = false
    }
    await dbApi.update(dbApi.ref(db, this.path(sessionId)), updates)
  }

  async markExhausted(sessionId: string): Promise<void> {
    const { db, dbApi } = await this.load()
    await dbApi.update(dbApi.ref(db, this.path(sessionId, '/meta')), {
      status: 'exhausted',
    })
  }
}
