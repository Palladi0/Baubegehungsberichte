import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CONFIG_KEYS = [
  'whatsapp_mode',
  'whatsapp_active_number',
  'whatsapp_template_sid_bestaetigung',
  'whatsapp_template_sid_unbekannt',
] as const

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('system_config')
    .select('key, value, updated_at')
    .in('key', CONFIG_KEYS as unknown as string[])
    .limit(CONFIG_KEYS.length)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  const config = Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<string, string>
  return NextResponse.json(config)
}

const E164_REGEX = /^\+[1-9]\d{1,14}$/
const TEMPLATE_SID_REGEX = /^HX[0-9a-f]{32}$/i

const PatchSchema = z.object({
  whatsapp_mode: z.enum(['sandbox', 'production']).optional(),
  whatsapp_active_number: z
    .string()
    .regex(E164_REGEX, 'Ungültiges E.164-Format (z. B. +4989123456)')
    .optional(),
  whatsapp_template_sid_bestaetigung: z
    .string()
    .regex(TEMPLATE_SID_REGEX, 'Ungültiges Template-SID-Format (HX gefolgt von 32 Hex-Zeichen)')
    .optional(),
  whatsapp_template_sid_unbekannt: z
    .string()
    .regex(TEMPLATE_SID_REGEX, 'Ungültiges Template-SID-Format (HX gefolgt von 32 Hex-Zeichen)')
    .optional(),
})

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Keine Felder angegeben' }, { status: 400 })
  }

  const db = createServiceClient()
  const rows = Object.entries(updates).map(([key, value]) => ({
    key,
    value: value as string,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await db.from('system_config').upsert(rows, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
