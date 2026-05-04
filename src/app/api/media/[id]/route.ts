import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'
export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  bildunterschrift: z.string().max(500).optional(),
  begehung_id: z.string().uuid().nullable().optional(),
})

async function getFotoWithAccessCheck(
  id: string,
  userId: string,
  role: string,
  service: ReturnType<typeof import('@/lib/supabase-service').createServiceClient>
) {
  const { data: foto } = await service
    .from('fotos')
    .select('id, projekt_id, uploader_id, datei_endung, geloescht_am')
    .eq('id', id)
    .single()

  if (!foto || foto.geloescht_am) return { foto: null, forbidden: false }

  const isOwner = foto.uploader_id === userId
  const isAdmin = role === 'admin'

  if (!isOwner && !isAdmin) {
    return { foto: null, forbidden: true }
  }

  return { foto, forbidden: false }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()
  const { foto, forbidden } = await getFotoWithAccessCheck(id, auth.userId, auth.role, service)

  if (forbidden) return NextResponse.json({ error: 'Zugriff verweigert.' }, { status: 403 })
  if (!foto) return NextResponse.json({ error: 'Foto nicht gefunden.' }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige JSON-Daten.' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })
  }

  // Sicherheitsprüfung: begehung_id muss zum selben Projekt gehören
  if (parsed.data.begehung_id) {
    const { data: begehung } = await service
      .from('begehungen')
      .select('projekt_id')
      .eq('id', parsed.data.begehung_id)
      .single()

    if (!begehung || begehung.projekt_id !== foto.projekt_id) {
      return NextResponse.json(
        { error: 'Die Begehung gehört nicht zu diesem Projekt.' },
        { status: 422 }
      )
    }
  }

  const { error } = await service
    .from('fotos')
    .update(parsed.data)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()
  const { foto, forbidden } = await getFotoWithAccessCheck(id, auth.userId, auth.role, service)

  if (forbidden) return NextResponse.json({ error: 'Zugriff verweigert.' }, { status: 403 })
  if (!foto) return NextResponse.json({ error: 'Foto nicht gefunden.' }, { status: 404 })

  const { error } = await service
    .from('fotos')
    .update({ geloescht_am: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 })
  }

  // Dateien bleiben auf Disk (Spec: Admin bereinigt manuell; bestehende PDFs bleiben funktionsfähig)
  return NextResponse.json({ ok: true })
}
