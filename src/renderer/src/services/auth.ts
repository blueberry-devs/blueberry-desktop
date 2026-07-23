const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface AuthResult {
  success: boolean
  accessToken: string | null
  refreshToken: string | null
  expiresIn: number | null
  user: AuthUser | null
  error: string | null
}

export interface AuthUser {
  id: string
  email: string
  username: string
  avatarUrl: string | null
}

export async function register(
  email: string,
  password: string,
  turnstileToken: string | null,
): Promise<AuthResult> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, turnstileToken }),
    })
    return (await res.json()) as AuthResult
  } catch {
    return {
      success: false,
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      user: null,
      error: 'Network error',
    }
  }
}

export async function login(
  email: string,
  password: string,
  turnstileToken: string | null,
): Promise<AuthResult> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, turnstileToken }),
    })
    return (await res.json()) as AuthResult
  } catch {
    return {
      success: false,
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      user: null,
      error: 'Network error',
    }
  }
}

export async function refresh(
  refreshToken: string,
): Promise<AuthResult> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    return (await res.json()) as AuthResult
  } catch {
    return {
      success: false,
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      user: null,
      error: 'Network error',
    }
  }
}

export async function getMe(
  accessToken: string,
): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    return (await res.json()) as AuthUser
  } catch {
    return null
  }
}
