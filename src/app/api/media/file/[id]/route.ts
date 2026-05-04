import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'
import path from 'path'
import fs from 'fs/promises'

export const dynamic = 'force-dynamic'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'photos')

type Version = 'thumb' | 'display' | 'original'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const version: Version = (request.nextUrl.searchParams.get('v') as Version) ?? 'thumb'

  if (!['thumb', 'display', 'original'].includes(version)) {
    return NextResponse.json({ error: 'Ungültige Version.' }, { status: 400 })
  }

  // Prevent path traversal
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: foto } = await service
    .from('fotos')
    .select('id, projekt_id, datei_endung, geloescht_am, uploader_id')
    .eq('id', id)
    .single()

  if (!foto || foto.geloescht_am) {
    return NextResponse.json({ error: 'Foto nicht gefunden.' }, { status: 404 })
  }

  // Access check for non-admins
  if (auth.role !== 'admin') {
    const { data: mitglied } = await service
      .from('projekt_mitarbeiter')
      .select('nutzer_id')
      .eq('projekt_id', foto.projekt_id)
      .eq('nutzer_id', auth.userId)
      .single()

    if (!mitglied) {
      return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
    }
  }

  let filename: string
  let contentType = 'image/jpeg'

  if (version === 'original') {
    filename = `original.${foto.datei_endung}`
    if (foto.datei_endung === 'png') contentType = 'image/png'
    else if (foto.datei_endung === 'webp') contentType = 'image/webp'
  } else {
    filename = `${version}.jpg`
  }

  const filePath = path.join(UPLOAD_DIR, foto.id, filename)

  try {
    const fileBuffer = await fs.readFile(filePath)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Datei nicht gefunden.' }, { status: 404 })
  }
}
