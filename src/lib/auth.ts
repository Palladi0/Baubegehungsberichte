import { createServerClient } from './supabase'

export type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; error: string; status: number }

export async function requireAdmin(authHeader: string | null): Promise<AuthResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, error: 'Nicht authentifiziert', status: 401 }
  }

  const token = authHeader.slice(7)
  const client = createServerClient(token)

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: 'Ungültige Session', status: 401 }
  }

  const { data: profile } = await client
    .from('nutzer_profile')
    .select('rolle')
    .eq('id', user.id)
    .single()

  if (profile?.rolle !== 'admin') {
    return { ok: false, error: 'Zugriff verweigert — Admin-Rolle erforderlich', status: 403 }
  }

  return { ok: true, userId: user.id, role: profile.rolle }
}
