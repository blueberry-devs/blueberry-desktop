const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface ApiClientOptions extends RequestInit {
  /** When true (default), a 401 triggers token refresh + one retry */
  authRetry?: boolean
}

/**
 * Thin fetch wrapper that auto-refreshes on 401.
 *
 * - Injects `Authorization: Bearer <token>` from the auth store.
 * - On 401, calls `doRefresh()` then retries ONCE with the new token.
 * - On refresh failure, calls `clearAuth()` so the UI reacts.
 *
 * Import this instead of raw `fetch` for any endpoint that needs auth.
 */
export async function apiFetch<T = Response>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { authRetry = true, ...init } = options

  // Lazy-import to avoid circular deps at module level
  const { getAuth } = await import('../store/auth')
  let token = getAuth().accessToken

  const headers = new Headers(init.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const doFetch = (): Promise<Response> =>
    fetch(`${BASE_URL}${path}`, { ...init, headers })

  let res = await doFetch()

  // 401 → try token refresh once
  if (res.status === 401 && authRetry && token) {
    const { doRefresh } = await import('../store/auth')
    const refreshed = await doRefresh()

    if (refreshed) {
      const newAuth = (await import('../store/auth')).getAuth()
      token = newAuth.accessToken
      headers.set('Authorization', `Bearer ${token}`)
      res = await doFetch()
    } else {
      const { getAuth: get } = await import('../store/auth')
      // If doRefresh already cleared auth (401 on refresh), that's handled.
      // Just return the original 401 response.
    }
  }

  // If T extends Response, return raw response for callers that check status themselves
  if (options.authRetry === undefined || options.authRetry === true) {
    // Default mode: caller can still check res.ok
    return res as unknown as T
  }

  return res as unknown as T
}

/**
 * Convenience: parse JSON or return null on failure.
 */
export async function apiFetchJson<T>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T | null> {
  try {
    const res = await apiFetch(path, options)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}
