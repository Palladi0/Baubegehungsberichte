import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerActionClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const LOCKOUT_THRESHOLD = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  passwort: z.string().min(1, 'Passwort erforderlich'),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'E-Mail oder Passwort ungültig.' }, { status: 400 })
  }

  const { email, passwort } = parsed.data
  const service = createServiceClient()

  // Find user by email to check lockout before auth attempt
  const { data: usersData } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUser = usersData?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (authUser) {
    const { data: preProfile } = await service
      .from('nutzer_profile')
      .select('aktiv, gesperrt_bis, fehlgeschlagene_versuche')
      .eq('id', authUser.id)
      .single()

    if (preProfile) {
      if (!preProfile.aktiv) {
        return NextResponse.json(
          { error: 'Ihr Account ist deaktiviert. Bitte wenden Sie sich an den Administrator.' },
          { status: 403 }
        )
      }

      // Return generic error for locked accounts to prevent user enumeration via lockout status.
      if (preProfile.gesperrt_bis && new Date(preProfile.gesperrt_bis) > new Date()) {
        return NextResponse.json({ error: 'E-Mail oder Passwort ungültig.' }, { status: 401 })
      }
    }
  }

  // Attempt login via SSR client so session cookies are set automatically
  const supabase = await createServerActionClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: passwort,
  })

  if (error || !data.user || !data.session) {
    // Increment failed attempts if the user exists in the system
    if (authUser) {
      const { data: currentProfile } = await service
        .from('nutzer_profile')
        .select('fehlgeschlagene_versuche')
        .eq('id', authUser.id)
        .single()

      if (currentProfile) {
        const newCount = (currentProfile.fehlgeschlagene_versuche ?? 0) + 1
        const update: Record<string, unknown> = { fehlgeschlagene_versuche: newCount }
        if (newCount >= LOCKOUT_THRESHOLD) {
          update.gesperrt_bis = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
        }
        await service.from('nutzer_profile').update(update).eq('id', authUser.id)
      }
    }

    return NextResponse.json({ error: 'E-Mail oder Passwort ungültig.' }, { status: 401 })
  }

  // Double-check profile on successful auth
  const { data: profile } = await service
    .from('nutzer_profile')
    .select('aktiv, gesperrt_bis')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.aktiv) {
    await supabase.auth.signOut()
    return NextResponse.json(
      {
        error:
          'Ihr Account ist deaktiviert. Bitte wenden Sie sich an den Administrator.',
      },
      { status: 403 }
    )
  }

  if (profile.gesperrt_bis && new Date(profile.gesperrt_bis) > new Date()) {
    await supabase.auth.signOut()
    const remainingMs = new Date(profile.gesperrt_bis).getTime() - Date.now()
    const minutes = Math.max(1, Math.ceil(remainingMs / 60_000))
    return NextResponse.json(
      {
        error: `Account vorübergehend gesperrt. Bitte in ca. ${minutes} Minute(n) erneut versuchen.`,
      },
      { status: 403 }
    )
  }

  // Success: reset lockout counter and record last login
  await service
    .from('nutzer_profile')
    .update({
      fehlgeschlagene_versuche: 0,
      gesperrt_bis: null,
      zuletzt_eingeloggt_am: new Date().toISOString(),
    })
    .eq('id', data.user.id)

  return NextResponse.json({ success: true })
}
