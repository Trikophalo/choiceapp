import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import de from '@/i18n/locales/de.json'

type Nested = { [key: string]: string | Nested }

function flatten(source: Nested, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) =>
    typeof value === 'object'
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

describe('translations', () => {
  const enKeys = flatten(en as Nested)
  const deKeys = flatten(de as Nested)

  it('define exactly the same keys, so nothing falls back silently', () => {
    expect(deKeys.sort()).toEqual(enKeys.sort())
  })

  it('have no empty strings', () => {
    for (const [locale, bundle] of [['en', en], ['de', de]] as const) {
      const walk = (source: Nested, path = ''): void => {
        for (const [key, value] of Object.entries(source)) {
          if (typeof value === 'object') walk(value, `${path}${key}.`)
          else expect(value.trim(), `${locale}:${path}${key}`).not.toBe('')
        }
      }
      walk(bundle as Nested)
    }
  })

  it('use the same interpolation placeholders in both languages', () => {
    const placeholders = (bundle: Nested, path = ''): Record<string, string[]> => {
      const out: Record<string, string[]> = {}
      for (const [key, value] of Object.entries(bundle)) {
        if (typeof value === 'object') Object.assign(out, placeholders(value, `${path}${key}.`))
        else {
          const found = [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
          if (found.length) out[`${path}${key}`] = found
        }
      }
      return out
    }
    expect(placeholders(de as Nested)).toEqual(placeholders(en as Nested))
  })
})
