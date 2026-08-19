export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number
  /** Number of extra attempts after the first one. */
  retries?: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * fetch + JSON with a timeout, bounded retries and exponential backoff.
 * Public APIs (Overpass especially) fail transiently often enough that this
 * pays for itself.
 */
export async function fetchJson<T>(
  url: string,
  { timeoutMs = 12_000, retries = 1, signal, ...init }: FetchJsonOptions = {},
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), timeoutMs)
    // Abort if either the caller cancels or our own timeout fires.
    const onOuterAbort = () => timeout.abort()
    signal?.addEventListener('abort', onOuterAbort, { once: true })

    try {
      const res = await fetch(url, { ...init, signal: timeout.signal })
      if (!res.ok) {
        throw new HttpError(`Request failed: ${res.status}`, res.status)
      }
      return (await res.json()) as T
    } catch (err) {
      lastError = err
      // A caller-initiated abort is final; never retry it.
      if (signal?.aborted) throw err
      if (attempt < retries) await sleep(400 * 2 ** attempt)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onOuterAbort)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new HttpError(String(lastError))
}

/** Strips HTML and collapses whitespace, then trims to a card-sized snippet. */
export function truncate(text: string | undefined | null, max: number): string {
  if (!text) return ''
  const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`
}

/**
 * JSONP fallback for public APIs that never send CORS headers — the iTunes
 * Search API being the important one here. A <script> tag is exempt from the
 * same-origin policy, so the response arrives as a function call instead of a
 * blocked fetch. Only ever use this with trusted, well-known endpoints.
 */
export function fetchJsonp<T>(
  url: string,
  { timeoutMs = 10_000, callbackParam = 'callback' } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new HttpError('jsonp-unavailable'))
      return
    }

    const name = `__jsonp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      cleanup()
      reject(new HttpError('jsonp-timeout'))
    }, timeoutMs)

    function cleanup() {
      clearTimeout(timer)
      delete (window as unknown as Record<string, unknown>)[name]
      script.remove()
    }

    ;(window as unknown as Record<string, (data: T) => void>)[name] = (
      data: T,
    ) => {
      cleanup()
      resolve(data)
    }

    script.onerror = () => {
      cleanup()
      reject(new HttpError('jsonp-failed'))
    }
    script.src = `${url}${url.includes('?') ? '&' : '?'}${callbackParam}=${name}`
    document.head.appendChild(script)
  })
}
