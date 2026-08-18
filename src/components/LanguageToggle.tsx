import { useTranslation } from 'react-i18next'
import type { Locale } from '@/types'
import { SUPPORTED_LOCALES } from '@/i18n'

export function LanguageToggle() {
  const { i18n, t } = useTranslation()
  const active = (i18n.resolvedLanguage ?? 'en') as Locale

  return (
    <div
      className="inline-flex rounded-full bg-surface-sunk p-1 ring-1 ring-line"
      role="group"
      aria-label={t('language.label')}
    >
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => void i18n.changeLanguage(locale)}
          aria-pressed={active === locale}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            active === locale
              ? 'bg-surface text-ink shadow-soft'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
