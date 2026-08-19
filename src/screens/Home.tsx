import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Screen } from '@/components/ui'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'

type Mode = 'solo' | 'group'

/**
 * Step 1 of the flow: who is deciding. The category comes on its own screen
 * afterwards — the mode changes what a round *is* (a private pick vs. a
 * shared link), so it is settled first.
 */
export function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const choose = (mode: Mode) => navigate(`/categories?mode=${mode}`)

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

      <div className="mt-8 mb-8">
        <h1 className="text-[2.1rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.4rem]">
          {t('home.pickMode')}
        </h1>
        <p className="mt-2 text-ink-muted">{t('app.tagline')}</p>
      </div>

      <div className="flex flex-col gap-4">
        <ModeCard
          emoji="🙋"
          label={t('home.modeSolo')}
          hint={t('home.modeSoloHint')}
          onSelect={() => choose('solo')}
        />
        <ModeCard
          emoji="👥"
          label={t('home.modeGroup')}
          hint={t('home.modeGroupHint')}
          onSelect={() => choose('group')}
        />
      </div>

      <div className="mt-auto pb-4 pt-8">
        <p className="px-2 text-center text-xs leading-relaxed text-ink-faint">
          {t('footer.attribution')}
        </p>
      </div>
    </Screen>
  )
}

function ModeCard({
  emoji,
  label,
  hint,
  onSelect,
}: {
  emoji: string
  label: string
  hint: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex items-center gap-4 rounded-3xl bg-surface p-5 text-left shadow-soft ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 active:scale-[0.99]"
    >
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-sunk text-3xl"
        aria-hidden="true"
      >
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold tracking-tight">{label}</span>
        <span className="mt-0.5 block text-sm leading-snug text-ink-muted">
          {hint}
        </span>
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-accent"
        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}
