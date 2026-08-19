import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EMOJI_CHOICES } from '@/store/useAppStore'
import { BackLink, Button, Screen } from '@/components/ui'

interface IdentityFormProps {
  title: string
  body: string
  submitLabel: string
  initialName?: string
  initialEmoji?: string
  busy?: boolean
  error?: boolean
  /** Overrides the generic error copy when set. */
  errorText?: string
  backTo?: string
  onSubmit: (name: string, emoji: string) => void
}

/** Lightweight identity: a name and an avatar, no account anywhere. */
export function IdentityForm({
  title,
  body,
  submitLabel,
  initialName = '',
  initialEmoji = EMOJI_CHOICES[0],
  busy,
  error,
  errorText,
  backTo = '/',
  onSubmit,
}: IdentityFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)
  const [emoji, setEmoji] = useState(initialEmoji)

  const trimmed = name.trim().slice(0, 24)

  return (
    <Screen>
      <div className="py-3">
        <BackLink to={backTo} label={t('common.back')} />
      </div>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed) onSubmit(trimmed, emoji)
        }}
      >
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-ink-muted">{body}</p>

        <div className="mt-7">
          <label htmlFor="name" className="text-sm font-medium text-ink-muted">
            {t('group.yourName')}
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('group.namePlaceholder')}
            maxLength={24}
            autoComplete="nickname"
            className="mt-2 w-full rounded-2xl bg-surface px-4 py-3.5 text-base outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
          />
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-ink-muted">
            {t('group.pickEmoji')}
          </legend>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {EMOJI_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setEmoji(choice)}
                aria-pressed={emoji === choice}
                aria-label={choice}
                className={`flex aspect-square items-center justify-center rounded-2xl text-2xl transition active:scale-90 ${
                  emoji === choice
                    ? 'bg-surface shadow-soft ring-2 ring-accent'
                    : 'bg-surface-sunk hover:-translate-y-0.5 hover:bg-surface hover:shadow-soft'
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="mt-5 text-sm leading-relaxed text-nope">
            {errorText ?? t('swipe.errorBody')}
          </p>
        )}

        <div className="mt-auto pb-4 pt-8">
          <Button type="submit" disabled={!trimmed || busy} full>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Screen>
  )
}
