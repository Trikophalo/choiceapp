import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import de from './locales/de.json'
import type { Locale } from '@/types'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'de']

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES,
    // "de-AT" and friends should resolve to "de".
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'swipedecide.locale',
      caches: ['localStorage'],
    },
  })

function syncDocumentLang(lng: string) {
  document.documentElement.lang = lng
}

syncDocumentLang(i18n.resolvedLanguage ?? 'en')
i18n.on('languageChanged', syncDocumentLang)

export function currentLocale(): Locale {
  const lng = i18n.resolvedLanguage ?? 'en'
  return (SUPPORTED_LOCALES as string[]).includes(lng) ? (lng as Locale) : 'en'
}

export default i18n
