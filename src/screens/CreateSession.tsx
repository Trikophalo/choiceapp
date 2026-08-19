import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore, EMOJI_CHOICES } from '@/store/useAppStore'
import { getSync } from '@/sync'
import { createSessionId } from '@/lib/random'
import { Screen, Spinner } from '@/components/ui'
import { currentLocale } from '@/i18n'
import { IdentityForm } from '@/components/IdentityForm'

/** Host entry point: pick an identity, mint a session, go to the lobby. */
export function CreateSession() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { category, radiusM, displayName, emoji, setIdentity } = useAppStore()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(false)
  // React 18 StrictMode double-invokes effects; this keeps one session per host.
  const created = useRef(false)

  const create = async (name: string, chosenEmoji: string) => {
    if (created.current) return
    created.current = true
    setCreating(true)
    setError(false)

    const sessionId = createSessionId()
    try {
      await getSync().createSession({
        sessionId,
        category,
        locale: currentLocale(),
        filters: {
          ...(category === 'restaurants' ? { radiusM } : {}),
        },
        host: { name, emoji: chosenEmoji },
      })
      navigate(`/s/${sessionId}`, { replace: true })
    } catch {
      created.current = false
      setCreating(false)
      setError(true)
    }
  }

  if (creating) {
    return (
      <Screen>
        <div className="flex flex-1 items-center justify-center">
          <Spinner label={t('app.loading')} />
        </div>
      </Screen>
    )
  }

  return (
    <IdentityForm
      backTo="/categories?mode=group"
      title={t('home.createSession')}
      body={t('group.joinBody')}
      submitLabel={t('home.createSession')}
      error={error}
      initialName={displayName}
      initialEmoji={emoji}
      onSubmit={(name, chosenEmoji) => {
        setIdentity(name, chosenEmoji)
        void create(name, chosenEmoji)
      }}
    />
  )
}

export { EMOJI_CHOICES }
