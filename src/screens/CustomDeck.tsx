import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCustomStore } from '@/store/useCustomStore'
import { useAppStore } from '@/store/useAppStore'
import { BackLink, Button, Screen } from '@/components/ui'
import { CardArt } from '@/components/CardArt'

const MAX_ENTRIES = 40

/** Editor for the user's own deck — the entries become the cards. */
export function CustomDeck() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mode = params.get('mode') === 'group' ? 'group' : 'solo'

  const { entries, addEntry, removeEntry } = useCustomStore()
  const setCategory = useAppStore((s) => s.setCategory)

  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const trimmedTitle = title.trim().slice(0, 60)
  const canStart = entries.length >= 2

  const add = () => {
    if (!trimmedTitle || entries.length >= MAX_ENTRIES) return
    const url = imageUrl.trim()
    addEntry({
      title: trimmedTitle,
      imageUrl: url.startsWith('https://') ? url : undefined,
    })
    setTitle('')
    setImageUrl('')
  }

  const start = () => {
    setCategory('custom')
    navigate(mode === 'solo' ? '/solo' : '/create')
  }

  return (
    <Screen>
      <div className="py-3">
        <BackLink to={`/categories?mode=${mode}`} label={t('common.back')} />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">
        {t('custom.title')}
      </h1>
      <p className="mt-2 text-ink-muted">{t('custom.body')}</p>

      <form
        className="mt-6 rounded-3xl bg-surface p-4 shadow-soft ring-1 ring-line"
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <label htmlFor="custom-title" className="text-sm font-medium text-ink-muted">
          {t('custom.entryTitle')}
        </label>
        <input
          id="custom-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('custom.entryPlaceholder')}
          maxLength={60}
          className="mt-2 w-full rounded-2xl bg-surface-sunk px-4 py-3 text-base outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />
        <label htmlFor="custom-image" className="mt-3 block text-sm font-medium text-ink-muted">
          {t('custom.entryImage')}
        </label>
        <input
          id="custom-image"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="mt-2 w-full rounded-2xl bg-surface-sunk px-4 py-3 text-base outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={!trimmedTitle || entries.length >= MAX_ENTRIES}
          className="mt-3"
          full
        >
          {t('custom.add')}
        </Button>
        {entries.length >= MAX_ENTRIES && (
          <p className="mt-2 text-sm text-nope">{t('custom.limit', { max: MAX_ENTRIES })}</p>
        )}
      </form>

      {entries.length > 0 && (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 p-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                <CardArt
                  src={entry.imageUrl}
                  title={entry.title}
                  seed={entry.id}
                  className="h-full w-full"
                />
              </div>
              <span className="min-w-0 flex-1 truncate font-medium">
                {entry.title}
              </span>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                aria-label={t('custom.remove', { title: entry.title })}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-surface-sunk hover:text-nope"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pb-4 pt-6">
        <Button onClick={start} disabled={!canStart} full>
          {canStart
            ? t('custom.start', { count: entries.length })
            : t('custom.needMore')}
        </Button>
      </div>
    </Screen>
  )
}
