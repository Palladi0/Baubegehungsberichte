import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'photos')
const MAX_FILES = 20
const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

async function processImage(buffer: Buffer, mimeType: string): Promise<{
  original: Buffer
  display: Buffer
  thumb: Buffer
  ext: string
}> {
  let workBuffer = buffer
  let ext = 'jpg'

  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    const heicConvert = (await import('heic-convert')).default
    workBuffer = Buffer.from(
      await heicConvert({ buffer: workBuffer, format: 'JPEG', quality: 0.92 })
    )
  } else if (mimeType === 'image/png') {
    ext = 'png'
  } else if (mimeType === 'image/webp') {
    ext = 'webp'
  }

  const sharp = (await import('sharp')).default

  const display = await sharp(workBuffer)
    .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const thumb = await sharp(workBuffer)
    .resize(400, 300, { fit: 'cover' })
    .jpeg({ quality: 75 })
    .toBuffer()

  return { original: workBuffer, display, thumb, ext }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Formulardaten.' }, { status: 400 })
  }

  const projektId = formData.get('projekt_id')?.toString()
  const begehungId = formData.get('begehung_id')?.toString() || null

  if (!projektId) {
    return NextResponse.json({ error: 'projekt_id ist erforderlich.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify user has access to this project
  const { data: projekt } = await service
    .from('projekte')
    .select('id')
    .eq('id', projektId)
    .single()

  if (!projekt) {
    return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 })
  }

  if (auth.role !== 'admin') {
    const { data: mitglied } = await service
      .from('projekt_mitarbeiter')
      .select('nutzer_id')
      .eq('projekt_id', projektId)
      .eq('nutzer_id', auth.userId)
      .single()

    if (!mitglied) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt.' }, { status: 403 })
    }
  }

  // BUG-004: Validate begehung_id belongs to the same project
  if (begehungId) {
    const { data: begehung } = await service
      .from('begehungen')
      .select('projekt_id')
      .eq('id', begehungId)
      .single()

    if (!begehung || begehung.projekt_id !== projektId) {
      return NextResponse.json(
        { error: 'Die Begehung gehört nicht zu diesem Projekt.' },
        { status: 422 }
      )
    }
  }

  const files = formData.getAll('files') as File[]
  if (!files.length) {
    return NextResponse.json({ error: 'Keine Dateien übermittelt.' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximal ${MAX_FILES} Dateien pro Upload erlaubt.` },
      { status: 400 }
    )
  }

  const results: { id: string; name: string; error?: string }[] = []

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      results.push({
        id: '',
        name: file.name,
        error: 'Nur JPEG, PNG, HEIC und WebP werden unterstützt.',
      })
      continue
    }
    if (file.size > MAX_SIZE_BYTES) {
      results.push({
        id: '',
        name: file.name,
        error: 'Diese Datei überschreitet die maximale Dateigröße von 25 MB.',
      })
      continue
    }

    try {
      const rawBuffer = Buffer.from(await file.arrayBuffer())
      const { original, display, thumb, ext } = await processImage(rawBuffer, file.type)

      const fotoId = randomUUID()
      const fotoDir = path.join(UPLOAD_DIR, fotoId)
      await fs.mkdir(fotoDir, { recursive: true })

      await Promise.all([
        fs.writeFile(path.join(fotoDir, `original.${ext}`), original),
        fs.writeFile(path.join(fotoDir, 'display.jpg'), display),
        fs.writeFile(path.join(fotoDir, 'thumb.jpg'), thumb),
      ])

      const { error: dbError } = await service.from('fotos').insert({
        id: fotoId,
        projekt_id: projektId,
        begehung_id: begehungId,
        uploader_id: auth.userId,
        original_dateiname: file.name,
        datei_endung: ext,
        dateigroesse_original: file.size,
      })

      if (dbError) {
        await fs.rm(fotoDir, { recursive: true, force: true })
        results.push({ id: '', name: file.name, error: 'Datenbankfehler beim Speichern.' })
        continue
      }

      results.push({ id: fotoId, name: file.name })
    } catch {
      results.push({ id: '', name: file.name, error: 'Verarbeitung fehlgeschlagen.' })
    }
  }

  const erfolge = results.filter((r) => !r.error)
  const fehler = results.filter((r) => r.error)

  return NextResponse.json({ hochgeladen: erfolge, fehler }, { status: 207 })
}
