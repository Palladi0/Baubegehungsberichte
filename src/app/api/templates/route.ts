import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth, requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const TEMPLATE_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

function withLogoUrl(row: Record<string, unknown>) {
  return {
    ...row,
    logo_url: row.logo_pfad ? `${TEMPLATE_BASE_URL}/api/templates/${row.id}/logo` : null,
  }
}

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('berichts_vorlagen')
    .select('*')
    .order('ist_standard', { ascending: false })
    .order('erstellt_am', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json((data ?? []).map(withLogoUrl))
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  firmenname: z.string().max(200).default(''),
  primaerfarbe: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiger HEX-Farbwert').default('#1a1a1a'),
  sekundaerfarbe: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiger HEX-Farbwert').default('#374151'),
  kopfzeilen_text: z.string().max(200).default(''),
  fusszeilen_text: z.string().max(200).default(''),
  schriftgroesse: z.enum(['klein', 'mittel', 'gross']).default('mittel'),
  ist_standard: z.boolean().default(false),
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

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const db = createServiceClient()

  // Wenn neues Template als Standard → alle anderen auf false setzen
  if (parsed.data.ist_standard) {
    await db.from('berichts_vorlagen').update({ ist_standard: false }).eq('ist_standard', true)
  }

  const { data, error } = await db
    .from('berichts_vorlagen')
    .insert({
      ...parsed.data,
      geaendert_am: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json(withLogoUrl(data as Record<string, unknown>), { status: 201 })
}
