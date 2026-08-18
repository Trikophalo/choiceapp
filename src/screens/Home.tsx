import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CategoryId } from '@/types'
import { CATEGORY_EMOJI, CATEGORY_ORDER, getProvider } from '@/providers'
import { useAppStore } from '@/store/useAppStore'
import { Button, Screen } from '@/components/ui'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'

type Mode = 'solo' | 'group'

export function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const category = useAppStore((s) => s.category)
  const setCategory = useAppStore((s) => s.setCategory)
  const [mode, setMode] = useState<Mode>('solo')

  const start = () => {
    // Restaurants need a location before a deck can be built.
    if (getProvider(category).capabilities.needsLocation) {
      navigate(`/setup?mode=${mode}`)
      return
    }
    navigate(mode === 'solo' ? '/solo' : '/create')
  }

  return (
    <Screen>
      <header className="flex flex-wrap items-center justify-between gap-y-2 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-sunset text-base shadow-soft">
            <span aria-hidden="true">👉</span>
          </div>
          <span className="truncate text-[1.05rem] font-semibold tracking-tight">
            {t('app.name')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      <div className="mt-4 mb-5">
        <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.4rem]">
          {t('home.greeting')}
        </h1>
        <p className="mt-2 text-ink-muted">{t('app.tagline')}</p>
      </div>

      <section aria-label={t('home.pickCategory')} className="grid grid-cols-2 gap-3">
        {CATEGORY_ORDER.map((id) => (
          <CategoryTile
            key={id}
            id={id}
            selected={category === id}
            onSelect={() => setCategory(id)}
          />
        ))}
      </section>

      <section className="mt-4">
        <div className="grid grid-cols-2 gap-3">
          <ModeTile
            label={t('home.modeSolo')}
            hint={t('home.modeSoloHint')}
            emoji="🙋"
            selected={mode === 'solo'}
            onSelect={() => setMode('solo')}
          />
          <ModeTile
            label={t('home.modeGroup')}
            hint={t('home.modeGroupHint')}
            emoji="👥"
            selected={mode === 'group'}
            onSelect={() => setMode('group')}
          />
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-3 pb-3 pt-5">
        <Button onClick={start} full>
          {mode === 'solo' ? t('home.start') : t('home.createSession')}
        </Button>
        <p className="px-2 text-center text-xs leading-relaxed text-ink-faint">
          {t('footer.attribution')}
        </p>
      </div>
    </Screen>
  )
}

function CategoryTile({
  id,
  selected,
  onSelect,
}: {
  id: CategoryId
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative overflow-hidden rounded-3xl p-3.5 text-left transition ${
        selected
          ? 'bg-surface shadow-card ring-2 ring-accent'
          : 'bg-surface shadow-soft ring-1 ring-line hover:-translate-y-0.5'
      }`}
    >
      <div className="text-3xl" aria-hidden="true">{CATEGORY_EMOJI[id]}</div>
      <div className="mt-2 font-semibold tracking-tight">
        {t(`categories.${id}`)}
      </div>
      <div className="mt-0.5 line-clamp-2 min-h-[2.1rem] text-[0.8rem] leading-snug text-ink-muted">
        {t(`categories.${id}Hint`)}
      </div>
      {selected && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-sunset text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
    </button>
  )
}

function ModeTile({
  label,
  hint,
  emoji,
  selected,
  onSelect,
}: {
  label: string
  hint: string
  emoji: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-3xl p-3.5 text-left transition ${
        selected
          ? 'bg-surface shadow-card ring-2 ring-accent'
          : 'bg-surface shadow-soft ring-1 ring-line hover:-translate-y-0.5'
      }`}
    >
      <div className="text-2xl" aria-hidden="true">{emoji}</div>
      <div className="mt-2 font-semibold tracking-tight">{label}</div>
      <div className="mt-0.5 line-clamp-2 min-h-[2.1rem] text-[0.8rem] leading-snug text-ink-muted">
        {hint}
      </div>
    </button>
  )
}
