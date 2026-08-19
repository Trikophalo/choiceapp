import { describe, expect, it, beforeEach } from 'vitest'
import { lettersForSeed } from '@/providers/cocktails'
import { proteinScore } from '@/providers/proteinRecipes'
import { LocalSync } from '@/sync/local'
import { MAX_ROUNDS } from '@/lib/match'
import type { Card } from '@/types'

describe('cocktail letter selection', () => {
  it('is deterministic for a seed and varies between seeds', () => {
    expect(lettersForSeed('abc')).toEqual(lettersForSeed('abc'))
    expect(lettersForSeed('abc')).not.toEqual(lettersForSeed('xyz'))
  })

  it('draws distinct letters, so a deck is never all one letter', () => {
    const letters = lettersForSeed('seed')
    expect(new Set(letters).size).toBe(letters.length)
    expect(letters.length).toBeGreaterThanOrEqual(5)
  })
})

describe('protein heuristic', () => {
  it('scores protein-forward ingredient lists higher', () => {
    const steak = proteinScore(['300g beef steak', '2 eggs', 'butter'])
    const salad = proteinScore(['lettuce', 'cucumber', 'olive oil'])
    expect(steak).toBeGreaterThan(salad)
    expect(salad).toBe(0)
  })
})

describe('LocalSync redeal', () => {
  const deck = (ids: string[]): Card[] => ids.map((id) => ({ id, title: id }))

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  async function playToExhaustion(sync: LocalSync, sid: string) {
    await sync.createSession({
      sessionId: sid,
      category: 'activities',
      locale: 'en',
      host: { name: 'Host', emoji: '🦊' },
    })
    await sync.startRound(sid, deck(['a', 'b']))
    await sync.like(sid, 'a')
    await sync.setProgress(sid, 2, true)
    await sync.markExhausted(sid)
  }

  function read(sid: string) {
    return JSON.parse(localStorage.getItem(`swipedecide.session.${sid}`)!)
  }

  it('replaces the deck, clears likes, resets progress and bumps the round', async () => {
    const sync = new LocalSync()
    await playToExhaustion(sync, 's1')

    await sync.redeal('s1', deck(['c', 'd']), 2, ['a', 'b'])
    const session = read('s1')

    expect(session.meta.status).toBe('active')
    expect(session.meta.round).toBe(2)
    expect(session.meta.seenIds).toEqual(['a', 'b'])
    expect(session.deck.map((card: Card) => card.id)).toEqual(['c', 'd'])
    expect(session.likes).toEqual({})
    const host = Object.values(session.participants)[0] as {
      progress: number
      done: boolean
    }
    expect(host.progress).toBe(0)
    expect(host.done).toBe(false)
  })

  it('finalises at the round cap when no unseen cards are left', async () => {
    const sync = new LocalSync()
    await playToExhaustion(sync, 's2')

    await sync.redeal('s2', [], 2, ['a', 'b'])
    const session = read('s2')

    expect(session.meta.status).toBe('exhausted')
    expect(session.meta.round).toBe(MAX_ROUNDS)
  })

  it('never disturbs a session that already has a winner', async () => {
    const sync = new LocalSync()
    await playToExhaustion(sync, 's3')
    await sync.claimWinner('s3', 'a')

    await sync.redeal('s3', deck(['c']), 2, ['a', 'b'])
    const session = read('s3')

    expect(session.winner.cardId).toBe('a')
    expect(session.deck.map((card: Card) => card.id)).toEqual(['a', 'b'])
  })
})
