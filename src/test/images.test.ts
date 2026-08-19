import { describe, expect, it } from 'vitest'
import { upscaleArtwork } from '@/providers/itunesMovies'
import { ACTIVITIES } from '@/data/activities'

describe('iTunes artwork upscaling', () => {
  it('replaces the 100px thumbnail with a retina poster', () => {
    expect(
      upscaleArtwork('https://is1-ssl.mzstatic.com/image/thumb/abc/source/100x100bb.jpg'),
    ).toBe('https://is1-ssl.mzstatic.com/image/thumb/abc/source/1200x1800bb.jpg')
  })

  it('handles the sizes iTunes returns, with or without the bb suffix', () => {
    for (const size of ['60x60bb.jpg', '100x100.jpg', '30x30bb.png', '512x512bb.jpg']) {
      const result = upscaleArtwork(`https://example.com/img/${size}`)
      expect(result).toBe('https://example.com/img/1200x1800bb.jpg')
    }
  })

  it('leaves an unrecognised URL untouched rather than corrupting it', () => {
    const url = 'https://example.com/poster.jpg'
    expect(upscaleArtwork(url)).toBe(url)
  })

  it('passes undefined through', () => {
    expect(upscaleArtwork(undefined)).toBeUndefined()
  })
})

describe('activity photo queries', () => {
  it('gives every activity a non-empty, ASCII search query', () => {
    for (const activity of ACTIVITIES) {
      expect(activity.photo, activity.id).toBeTruthy()
      expect(activity.photo.length, activity.id).toBeGreaterThan(2)
      // Commons search behaves best with plain English terms.
      expect(activity.photo, activity.id).toMatch(/^[a-z0-9 ]+$/)
    }
  })

  it('does not reuse the same query for every entry', () => {
    const unique = new Set(ACTIVITIES.map((a) => a.photo))
    expect(unique.size).toBeGreaterThan(ACTIVITIES.length * 0.9)
  })
})

describe('photo lookup budget', () => {
  it('gives up rather than delaying a deck when the source hangs', async () => {
    const { findPhotos } = await import('@/lib/photos')
    const original = globalThis.fetch
    // A source that never answers.
    globalThis.fetch = (() => new Promise(() => {})) as typeof fetch
    try {
      const started = Date.now()
      const result = await findPhotos(['a', 'b', 'c'], 800, undefined, 150)
      expect(Date.now() - started).toBeLessThan(1000)
      expect(result).toEqual([null, null, null])
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('commonsFileUrl (OSM wikimedia_commons tag)', () => {
  it('turns a File: tag into a sized Special:FilePath URL', async () => {
    const { commonsFileUrl } = await import('@/lib/photos')
    expect(commonsFileUrl('File:Cafe Beispiel Berlin.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Cafe%20Beispiel%20Berlin.jpg?width=1280',
    )
  })

  it('takes the first entry of a multi-value tag', async () => {
    const { commonsFileUrl } = await import('@/lib/photos')
    expect(commonsFileUrl('File:A.jpg;File:B.jpg')).toContain('A.jpg')
  })

  it('rejects categories, vectors and empty values', async () => {
    const { commonsFileUrl } = await import('@/lib/photos')
    expect(commonsFileUrl('Category:Restaurants in Berlin')).toBeUndefined()
    expect(commonsFileUrl('File:Logo.svg')).toBeUndefined()
    expect(commonsFileUrl('File:')).toBeUndefined()
    expect(commonsFileUrl(undefined)).toBeUndefined()
    expect(commonsFileUrl('Some plain text')).toBeUndefined()
  })
})

describe('cinemeta poster sizing', () => {
  it('upgrades small/medium renditions to large and passes others through', async () => {
    const { largePoster } = await import('@/providers/movieSources')
    expect(largePoster('https://images.metahub.space/poster/medium/tt0111161/img'))
      .toBe('https://images.metahub.space/poster/large/tt0111161/img')
    expect(largePoster('https://images.metahub.space/poster/small/tt1/img'))
      .toBe('https://images.metahub.space/poster/large/tt1/img')
    expect(largePoster('https://example.com/p.jpg')).toBe('https://example.com/p.jpg')
    expect(largePoster(undefined)).toBeUndefined()
  })
})
