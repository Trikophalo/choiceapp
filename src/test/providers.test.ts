import { describe, expect, it } from 'vitest'
import { activitiesProvider } from '@/providers/activities'
import { CATEGORY_ORDER, PROVIDERS } from '@/providers'
import { truncate } from '@/lib/http'
import { ACTIVITIES } from '@/data/activities'

describe('provider registry', () => {
  it('covers every category in the display order', () => {
    for (const id of CATEGORY_ORDER) {
      expect(PROVIDERS[id]).toBeDefined()
      expect(PROVIDERS[id].id).toBe(id)
    }
  })

  it('marks only restaurants as needing a location', () => {
    const needing = CATEGORY_ORDER.filter(
      (id) => PROVIDERS[id].capabilities.needsLocation,
    )
    expect(needing).toEqual(['restaurants'])
  })
})

describe('activities provider', () => {
  it('returns localised cards in the requested language', async () => {
    const [en] = await activitiesProvider.fetchDeck({ locale: 'en', size: 1, seed: 's' })
    const [de] = await activitiesProvider.fetchDeck({ locale: 'de', size: 1, seed: 's' })

    expect(en.id).toBe(de.id) // Same seed → same card…
    expect(en.title).not.toBe(de.title) // …different language.
    expect(de.subtitle).toBeTruthy()
  })

  it('never returns more cards than requested', async () => {
    const deck = await activitiesProvider.fetchDeck({ locale: 'en', size: 5, seed: 's' })
    expect(deck).toHaveLength(5)
  })

  it('caps at the dataset size when asked for more', async () => {
    const deck = await activitiesProvider.fetchDeck({ locale: 'en', size: 999, seed: 's' })
    expect(deck).toHaveLength(ACTIVITIES.length)
  })

  it('produces unique card ids', async () => {
    const deck = await activitiesProvider.fetchDeck({ locale: 'en', size: 25, seed: 's' })
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length)
  })
})

describe('activities dataset', () => {
  it('has unique ids and both languages filled in', () => {
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length)
    for (const activity of ACTIVITIES) {
      for (const locale of ['en', 'de'] as const) {
        expect(activity[locale].title.length).toBeGreaterThan(0)
        expect(activity[locale].subtitle.length).toBeGreaterThan(0)
        expect(activity[locale].badge.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('truncate', () => {
  it('strips markup and collapses whitespace', () => {
    expect(truncate('<p>Hello   <b>world</b></p>', 100)).toBe('Hello world')
  })

  it('adds an ellipsis only when it actually cuts', () => {
    expect(truncate('short', 100)).toBe('short')
    expect(truncate('a'.repeat(200), 20)).toHaveLength(21)
  })

  it('handles empty input', () => {
    expect(truncate(undefined, 10)).toBe('')
    expect(truncate(null, 10)).toBe('')
  })
})
