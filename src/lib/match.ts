import type { Card, Participant, SessionState } from '@/types'

/**
 * A card wins when EVERY participant has right-swiped it.
 *
 * Participants are frozen when the round starts, so the denominator cannot
 * drift mid-round. Where several cards qualify at once (two people completing
 * different cards in the same instant) this returns the earliest in deck
 * order, but the authoritative pick is the write-once `winner` field in the
 * session — this function only proposes a candidate.
 */
export function findUnanimousCardId(
  deck: readonly Card[],
  likes: Readonly<Record<string, Record<string, true>>>,
  participantIds: readonly string[],
): string | null {
  if (participantIds.length === 0) return null
  for (const card of deck) {
    const liked = likes[card.id]
    if (!liked) continue
    if (participantIds.every((uid) => liked[uid] === true)) return card.id
  }
  return null
}

/** Ranking used by the "no match" screen. */
export function rankByLikes(
  deck: readonly Card[],
  likes: Readonly<Record<string, Record<string, true>>>,
): Array<{ card: Card; count: number }> {
  return deck
    .map((card) => ({
      card,
      count: Object.keys(likes[card.id] ?? {}).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
}

export function activeParticipantIds(
  participants: Readonly<Record<string, Participant>>,
): string[] {
  return Object.keys(participants)
}

/** True when every participant has swiped the whole deck with no unanimous card. */
export function isExhausted(session: SessionState): boolean {
  const ids = activeParticipantIds(session.participants)
  if (ids.length === 0) return false
  return ids.every((uid) => session.participants[uid]?.done)
}

/** Who the "waiting for…" line should name. */
export function stillSwiping(
  participants: Readonly<Record<string, Participant>>,
  selfUid: string,
): Participant[] {
  return Object.entries(participants)
    .filter(([uid, p]) => uid !== selfUid && !p.done)
    .map(([, p]) => p)
}
