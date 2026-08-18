import { useEffect, useMemo, useRef, useState } from 'react'
import type { SessionState } from '@/types'
import { getSync } from '@/sync'

interface UseSessionResult {
  session: SessionState | null
  uid: string | null
  /** Distinguishes "still connecting" from "this session does not exist". */
  loading: boolean
}

export function useSession(sessionId: string | undefined): UseSessionResult {
  const [session, setSession] = useState<SessionState | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const sync = useMemo(() => getSync(), [])
  const settled = useRef(false)

  useEffect(() => {
    let active = true
    void sync.signIn().then((id) => {
      if (active) setUid(id)
    })
    return () => {
      active = false
    }
  }, [sync])

  useEffect(() => {
    if (!sessionId) return
    settled.current = false
    setLoading(true)

    const unsubscribe = sync.subscribe(sessionId, (next) => {
      setSession(next)
      settled.current = true
      setLoading(false)
    })

    return unsubscribe
  }, [sessionId, sync])

  return { session, uid, loading }
}
