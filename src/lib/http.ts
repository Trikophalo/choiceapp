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
