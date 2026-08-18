import { describe, expect, it } from 'vitest'
import { seededShuffle, createSessionId, hashSeed } from '@/lib/random'

describe('seededShuffle', () => {
  const items = Array.from({ length: 30 }, (_, i) => i)

  it('is deterministic for a given seed', () => {
    expect(seededShuffle(items, 'abc')).toEqual(seededShuffle(items, 'abc'))
  })

  it('produces a different order for a different seed', () => {
    expect(seededShuffle(items, 'abc')).not.toEqual(seededShuffle(items, 'xyz'))
  })

  it('keeps every element exactly once', () => {
    expect([...seededShuffle(items, 'seed')].sort((a, b) => a - b)).toEqual(items)
  })

  it('does not mutate the input', () => {
    const original = [...items]
    seededShuffle(items, 'seed')
    expect(items).toEqual(original)
  })

  it('handles empty and single-item arrays', () => {
    expect(seededShuffle([], 's')).toEqual([])
    expect(seededShuffle(['only'], 's')).toEqual(['only'])
  })
})

describe('hashSeed', () => {
  it('is stable and unsigned', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'))
    expect(hashSeed('abc')).toBeGreaterThanOrEqual(0)
  })
})

describe('createSessionId', () => {
  it('uses an unambiguous alphabet and the requested length', () => {
    const id = createSessionId(10)
    expect(id).toHaveLength(10)
    // No 0/1/i/l/o to avoid mis-typed links.
    expect(id).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]+$/)
  })

  it('is unlikely to collide', () => {
    const ids = new Set(Array.from({ length: 500 }, () => createSessionId()))
    expect(ids.size).toBe(500)
  })
})
