import { useTranslation } from 'react-i18next'
import { useAppStore, type ThemePreference } from '@/store/useAppStore'

const OPTIONS: ThemePreference[] = ['system', 'light', 'dark']

const ICONS: Record<ThemePreference, string> = {
  system: 'M3 5.5h18v10.5H3zM9 20h6M12 16v4',
  light: 'M12 4v2m0 12v2m8-8h-2M6 12H4m13.66-5.66l-1.42 1.42M7.76 16.24l-1.42 1.42m11.32 0l-1.42-1.42M7.76 7.76L6.34 6.34',
  dark: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
}

export function ThemeToggle() {
  const { t } = useTranslation()
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  return (
    <div
      className="inline-flex rounded-full bg-surface-sunk p-1 ring-1 ring-line"
      role="group"
      aria-label={t('home.theme')}
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setTheme(option)}
          aria-pressed={theme === option}
          title={t(`theme.${option}`)}
          className={`rounded-full p-1.5 transition active:scale-90 ${
            theme === option
              ? 'bg-surface text-ink shadow-soft'
              : 'text-ink-muted hover:bg-surface/70 hover:text-ink'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={option === 'dark' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d={ICONS[option]} />
          </svg>
          <span className="sr-only">{t(`theme.${option}`)}</span>
        </button>
      ))}
    </div>
  )
}
