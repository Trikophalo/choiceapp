import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CategoryId } from '@/types'
import { CATEGORY_EMOJI, CATEGORY_ORDER, getProvider } from '@/providers'
import { useAppStore } from '@/store/useAppStore'
import { BackLink, Screen } from '@/components/ui'

/** Step 2 of the flow: what to decide about. Tapping a tile starts the round
 *  (or the location setup, where the category needs one). */
export function Categories() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mode = params.get('mode') === 'group' ? 'group' : 'solo'
  const setCategory = useAppStore((s) => s.setCategory)

  const choose = (id: CategoryId) => {
    setCategory(id)
    // The custom deck needs its entries written before a round can start.
    if (id === 'custom') {
      navigate(`/custom?mode=${mode}`)
      return
    }
    if (getProvider(id).capabilities.needsLocation) {
      navigate(`/setup?mode=${mode}`)
      return
    }
    navigate(mode === 'solo' ? '/solo' : '/create')
  }

  return (
    <Screen>
      <div className="flex items-center justify-between py-3">
        <BackLink to="/" label={t('common.back')} />
        <span className="flex items-center gap-1.5 rounded-full bg-surface-sunk px-3 py-1.5 text-sm font-medium text-ink-muted">
          <span aria-hidden="true">{mode === 'solo' ? '🙋' : '👥'}</span>
          {t(mode === 'solo' ? 'home.modeSolo' : 'home.modeGroup')}
        </span>
      </div>

      <div className="mt-3 mb-6">
        <h1 className="text-[2.1rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.4rem]">
          {t('home.pickCategory')}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CATEGORY_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => choose(id)}
            className="rounded-3xl bg-surface p-4 text-left shadow-soft ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 active:scale-[0.99]"
          >
            <div className="text-3xl" aria-hidden="true">
              {CATEGORY_EMOJI[id]}
            </div>
            <div className="mt-2 font-semibold tracking-tight">
              {t(`categories.${id}`)}
            </div>
            <div className="mt-0.5 line-clamp-2 min-h-[1.9rem] text-[0.8rem] leading-snug text-ink-muted">
              {t(`categories.${id}Hint`)}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-auto pb-4 pt-8">
        <p className="px-2 text-center text-xs leading-relaxed text-ink-faint">
          {t('footer.attribution')}
        </p>
      </div>
    </Screen>
  )
}
