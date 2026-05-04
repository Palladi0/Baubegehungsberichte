import { createServerActionClient } from './supabase-server'

export type AuthSuccess = { ok: true; userId: string; email: string; role: string }
export type AuthFailure = { ok: false; error: string; status: number }
export type AuthResult = AuthSuccess | AuthFailure

/**
 * Verifies that the current request has an authenticated session (via cookie).
 * Returns the user's id, email, and role from nutzer_profile.
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createServerActionClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: 'Nicht authentifiziert', status: 401 }
  }

  const { data: profile, error: profileError } = await supabase
    .from('nutzer_profile')
    .select('rolle, aktiv, gesperrt_bis')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false, error: 'Profil nicht gefunden', status: 403 }
  }

  if (!profile.aktiv) {
    return { ok: false, error: 'Account deaktiviert', status: 403 }
  }

  if (profile.gesperrt_bis && new Date(profile.gesperrt_bis) > new Date()) {
    return { ok: false, error: 'Account vorübergehend gesperrt', status: 403 }
  }

  return {
    ok: true,
    userId: user.id,
    email: user.email ?? '',
    role: profile.rolle as string,
  }
}

/**
 * Verifies that the current request has an authenticated admin session.
 * Accepts an optional argument for backward compatibility — the value is ignored
 * because sessions are now read from HTTP-only cookies.
 */
export async function requireAdmin(_ignored?: unknown): Promise<AuthResult> {
  const result = await requireAuth()
  if (!result.ok) {
    return result
  }

  if (result.role !== 'admin') {
    return { ok: false, error: 'Zugriff verweigert — Admin-Rolle erforderlich', status: 403 }
  }

  return result
}
