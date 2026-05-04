import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth, requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const TEMPLATE_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
const TEMPLATE_UPLOAD_PATH = process.env.TEMPLATE_UPLOAD_PATH
  ?? path.join(process.cwd(), 'uploads', 'templates')

function withLogoUrl(row: Record<string, unknown>) {
  return {
    ...row,
    logo_url: row.logo_pfad ? `${TEMPLATE_BASE_URL}/api/templates/${row.id}/logo` : null,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('berichts_vorlagen')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 })
  }

  return NextResponse.json(withLogoUrl(data as Record<string, unknown>))
}

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  firmenname: z.string().max(200).optional(),
  primaerfarbe: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiger HEX-Farbwert').optional(),
  sekundaerfarbe: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiger HEX-Farbwert').optional(),
  kopfzeilen_text: z.string().max(200).optional(),
  fusszeilen_text: z.string().max(200).optional(),
  schriftgroesse: z.enum(['klein', 'mittel', 'gross']).optional(),
  ist_standard: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Keine Felder angegeben' }, { status: 400 })
  }

  const db = createServiceClient()

  // Wenn auf Standard gesetzt → alle anderen zurücksetzen
  if (parsed.data.ist_standard) {
    await db.from('berichts_vorlagen').update({ ist_standard: false }).neq('id', id)
  }

  const { data, error } = await db
    .from('berichts_vorlagen')
    .update({ ...parsed.data, geaendert_am: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Vorlage nicht gefunden oder Datenbankfehler' }, { status: 404 })
  }

  return NextResponse.json(withLogoUrl(data as Record<string, unknown>))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const db = createServiceClient()

  // Lösch-Schutz: Berichte die diese Vorlage referenzieren zählen
  const { count } = await db
    .from('berichte')
    .select('id', { count: 'exact', head: true })
    .eq('vorlage_id', id)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Diese Vorlage wird von ${count} Bericht(en) verwendet und kann nicht gelöscht werden.` },
      { status: 409 }
    )
  }

  // Vorlage laden, um logo_pfad für Dateilöschung zu erhalten
  const { data: vorlage } = await db
    .from('berichts_vorlagen')
    .select('logo_pfad, ist_standard')
    .eq('id', id)
    .single()

  if (!vorlage) {
    return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 })
  }

  if (vorlage.ist_standard) {
    return NextResponse.json(
      { error: 'Das Standard-Template kann nicht gelöscht werden. Bitte zuerst ein anderes Template als Standard markieren.' },
      { status: 409 }
    )
  }

  const { error } = await db.from('berichts_vorlagen').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 })
  }

  // Logo-Verzeichnis bereinigen (best-effort)
  if (vorlage.logo_pfad) {
    const logoDir = path.join(TEMPLATE_UPLOAD_PATH, id)
    try {
      if (fs.existsSync(logoDir)) fs.rmSync(logoDir, { recursive: true })
    } catch { /* ignore */ }
  }

  return new NextResponse(null, { status: 204 })
}
