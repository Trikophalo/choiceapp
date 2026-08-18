import type { Card, CategoryId, Locale, SessionState } from '@/types'

export interface CreateSessionInput {
  sessionId: string
  category: CategoryId
  locale: Locale
  filters?: { radiusM?: number }
  host: { name: string; emoji: string }
}

export interface JoinInput {
  sessionId: string
  name: string
  emoji: string
}

/**
 * The contract group mode is written against. Two implementations exist:
 *
 *  - FirebaseSync  — real cross-device sync over a Realtime Database socket.
 *  - LocalSync     — BroadcastChannel + localStorage, same device only.
 *
 * Keeping the screens adapter-agnostic means group mode is fully playable
 * (and testable) before any backend credentials exist, and swapping backends
 * later touches one file.
 */
export interface SyncAdapter {
  readonly kind: 'firebase' | 'local'
  /** True when rounds work across devices; false for the demo adapter. */
  readonly isCrossDevice: boolean

  /** Resolves to this device's stable participant id. */
  signIn(): Promise<string>

  createSession(input: CreateSessionInput): Promise<void>
  join(input: JoinInput): Promise<void>

  /** Subscribe to the whole session; returns an unsubscribe function.
   *  `null` is delivered when the session does not exist. */
  subscribe(
    sessionId: string,
    onChange: (session: SessionState | null) => void,
  ): () => void

  /** Host only: publish the deck and flip the round to active. */
  startRound(sessionId: string, deck: Card[]): Promise<void>

  /** Record a right swipe. Left swipes only move `progress`. */
  like(sessionId: string, cardId: string): Promise<void>
  setProgress(sessionId: string, progress: number, done: boolean): Promise<void>

  /**
   * Write-once winner claim. Returns true if this client's claim committed —
   * exactly one claim wins even when two clients complete different cards in
   * the same instant.
   */
  claimWinner(sessionId: string, cardId: string): Promise<boolean>

  /** Ends the round with no unanimous card. */
  markExhausted(sessionId: string): Promise<void>
}
