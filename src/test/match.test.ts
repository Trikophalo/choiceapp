import { describe, expect, it } from 'vitest'
import {
  findUnanimousCardId,
  isExhausted,
  rankByLikes,
  stillSwiping,
} from '@/lib/match'
import type { Card, Participant, SessionState } from '@/types'

const deck: Card[] = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Bravo' },
  { id: 'c', title: 'Charlie' },
]

const participant = (over: Partial<Participant> = {}): Participant => ({
  name: 'P',
  emoji: '🦊',
  joinedAt: 1,
  online: true,
  progress: 0,
  done: false,
  ...over,
})

describe('findUnanimousCardId', () => {
  it('returns the card every participant liked', () => {
    const likes = {
      a: { u1: true as const },
      b: { u1: true as const, u2: true as const },
    }
    expect(findUnanimousCardId(deck, likes, ['u1', 'u2'])).toBe('b')
  })

  it('is null while any participant has not liked the card', () => {
    const likes = { a: { u1: true as const, u2: true as const } }
    expect(findUnanimousCardId(deck, likes, ['u1', 'u2', 'u3'])).toBeNull()
  })

  it('is null with no likes at all', () => {
    expect(findUnanimousCardId(deck, {}, ['u1'])).toBeNull()
  })

  it('is null when there are no participants, so an empty round cannot win', () => {
    expect(findUnanimousCardId(deck, { a: { u1: true } }, [])).toBeNull()
  })

  it('treats a single participant as unanimous', () => {
    expect(findUnanimousCardId(deck, { c: { solo: true } }, ['solo'])).toBe('c')
  })

  it('prefers deck order when several cards qualify at once', () => {
    const likes = {
      b: { u1: true as const, u2: true as const },
      c: { u1: true as const, u2: true as const },
    }
    // Deterministic across clients; the write-once winner claim is what makes
    // the choice authoritative.
    expect(findUnanimousCardId(deck, likes, ['u1', 'u2'])).toBe('b')
  })

  it('ignores likes from someone who is not a participant', () => {
    const likes = { a: { u1: true as const, ghost: true as const } }
    expect(findUnanimousCardId(deck, likes, ['u1', 'u2'])).toBeNull()
  })
})

describe('rankByLikes', () => {
  it('orders by like count and drops cards nobody liked', () => {
    const likes = {
      a: { u1: true as const },
      c: { u1: true as const, u2: true as const },
    }
    expect(rankByLikes(deck, likes).map((r) => [r.card.id, r.count])).toEqual([
      ['c', 2],
      ['a', 1],
    ])
  })
})

describe('isExhausted', () => {
  const base: SessionState = {
    meta: {
      v: 1, category: 'movies', status: 'active', hostId: 'u1',
      createdAt: 0, startedAt: 0, locale: 'en',
    },
    deck,
    participants: {},
    likes: {},
    winner: null,
  }

  it('is true only once every participant is done', () => {
    expect(isExhausted({
      ...base,
      participants: { u1: participant({ done: true }), u2: participant({ done: true }) },
    })).toBe(true)

    expect(isExhausted({
      ...base,
      participants: { u1: participant({ done: true }), u2: participant({ done: false }) },
    })).toBe(false)
  })

  it('is false for an empty session', () => {
    expect(isExhausted(base)).toBe(false)
  })
})

describe('stillSwiping', () => {
  it('lists others who have not finished, excluding yourself', () => {
    const participants = {
      me: participant({ name: 'Me', done: true }),
      anna: participant({ name: 'Anna', done: false }),
      ben: participant({ name: 'Ben', done: true }),
    }
    expect(stillSwiping(participants, 'me').map((p) => p.name)).toEqual(['Anna'])
  })
})
