import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const changePasswordSchema = z
  .object({
    aktuelles_passwort: z.string().min(1, 'Aktuelles Passwort erforderlich'),
    neues_passwort: z
      .string()
      .min(8, 'Neues Passwort muss mindestens 8 Zeichen enthalten'),
    passwort_bestaetigen: z.string(),
  })
  .refine((v) => v.neues_passwort === v.passwort_bestaetigen, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwort_bestaetigen'],
  })

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validierung fehlgeschlagen' },
      { status: 400 }
    )
  }

  // Aktuelles Passwort verifizieren: mit separatem Client einloggen
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: loginData, error: loginError } =
    await verifyClient.auth.signInWithPassword({
      email: auth.email,
      password: parsed.data.aktuelles_passwort,
    })

  if (loginError || !loginData.user) {
    return NextResponse.json(
      { error: 'Aktuelles Passwort ist nicht korrekt.' },
      { status: 400 }
    )
  }

  // Passwort aktualisieren über Service-Client
  const service = createServiceClient()
  const { error: updateError } = await service.auth.admin.updateUserById(auth.userId, {
    password: parsed.data.neues_passwort,
  })

  if (updateError) {
    return NextResponse.json(
      { error: 'Passwort konnte nicht aktualisiert werden.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
