import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCustomStore } from '@/store/useCustomStore'
import { useAppStore } from '@/store/useAppStore'
import { BackLink, Button, Screen } from '@/components/ui'
import { CardArt } from '@/components/CardArt'
import {
  compressImageFile,
  dataUriBytes,
  MAX_TOTAL_IMAGE_BYTES,
} from '@/lib/imageUpload'

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
  const [upload, setUpload] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const trimmedTitle = title.trim().slice(0, 60)
  const canStart = entries.length >= 2
  const usedImageBytes = entries.reduce(
    (sum, entry) =>
      sum +
      (entry.imageUrl?.startsWith('data:') ? dataUriBytes(entry.imageUrl) : 0),
    0,
  )
  const imageBudgetLeft = usedImageBytes < MAX_TOTAL_IMAGE_BYTES

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setUploadError(false)
    try {
      setUpload(await compressImageFile(file))
      setImageUrl('')
    } catch {
      setUploadError(true)
      setUpload(null)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const add = () => {
    if (!trimmedTitle || entries.length >= MAX_ENTRIES) return
    const url = imageUrl.trim()
    // An uploaded photo wins over a pasted URL; both are optional.
    const image =
      upload && imageBudgetLeft
        ? upload
        : url.startsWith('https://')
          ? url
          : undefined
    addEntry({ title: trimmedTitle, imageUrl: image })
    setTitle('')
    setImageUrl('')
    setUpload(null)
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
        <span className="mt-3 block text-sm font-medium text-ink-muted">
          {t('custom.entryImage')}
        </span>
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={fileRef}
            id="custom-file"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || !imageBudgetLeft}
            className="flex min-h-[2.9rem] items-center gap-2 rounded-2xl bg-surface-sunk px-4 text-sm font-medium ring-1 ring-line transition hover:bg-surface hover:shadow-soft active:scale-95 disabled:opacity-45"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0L7 9m5-5l5 5M4 20h16" />
            </svg>
            {busy ? t('custom.uploading') : t('custom.uploadPhoto')}
          </button>
          {upload && (
            <span className="relative h-11 w-11 overflow-hidden rounded-xl ring-1 ring-line">
              <img src={upload} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setUpload(null)}
                aria-label={t('common.close')}
                className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition hover:opacity-100"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        {uploadError && (
          <p className="mt-2 text-sm text-nope">{t('custom.uploadFailed')}</p>
        )}
        {!imageBudgetLeft && (
          <p className="mt-2 text-sm text-nope">{t('custom.imageBudget')}</p>
        )}
        {!upload && (
          <input
            id="custom-image"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder={t('custom.orUrl')}
            aria-label={t('custom.entryImage')}
            className="mt-2 w-full rounded-2xl bg-surface-sunk px-4 py-3 text-base outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
          />
        )}
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
