import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth, requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const TEMPLATE_UPLOAD_PATH = process.env.TEMPLATE_UPLOAD_PATH
  ?? path.join(process.cwd(), 'uploads', 'templates')

const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

// GET: Logo-Datei ausliefern
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return new NextResponse('Nicht autorisiert', { status: auth.status })
  }

  const { id } = await params
  const db = createServiceClient()

  const { data } = await db
    .from('berichts_vorlagen')
    .select('logo_pfad')
    .eq('id', id)
    .single()

  if (!data?.logo_pfad) {
    return new NextResponse('Kein Logo vorhanden', { status: 404 })
  }

  const absPath = path.isAbsolute(data.logo_pfad)
    ? data.logo_pfad
    : path.join(process.cwd(), data.logo_pfad)

  if (!fs.existsSync(absPath)) {
    return new NextResponse('Logo-Datei nicht gefunden', { status: 404 })
  }

  const ext = path.extname(absPath).toLowerCase().slice(1)
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    svg: 'image/svg+xml',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  }
  const contentType = mimeMap[ext] ?? 'application/octet-stream'

  const buffer = fs.readFileSync(absPath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

// POST: Logo hochladen (ersetzt vorhandenes)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const db = createServiceClient()

  const { data: vorlage } = await db
    .from('berichts_vorlagen')
    .select('id')
    .eq('id', id)
    .single()

  if (!vorlage) {
    return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('logo')

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Keine Datei übermittelt (Feld: logo)' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Datei zu groß (max. 2 MB)' }, { status: 413 })
  }

  const mimeType = file.type
  const ext = ALLOWED_TYPES[mimeType]
  if (!ext) {
    return NextResponse.json(
      { error: 'Ungültiges Dateiformat. Erlaubt: PNG, SVG, JPEG, WEBP' },
      { status: 415 }
    )
  }

  const logoDir = path.join(TEMPLATE_UPLOAD_PATH, id)
  await fsPromises.mkdir(logoDir, { recursive: true })

  // Altes Logo bereinigen
  try {
    const existing = await fsPromises.readdir(logoDir)
    for (const f of existing) {
      await fsPromises.unlink(path.join(logoDir, f))
    }
  } catch { /* ignore */ }

  const logoPath = path.join(logoDir, `logo.${ext}`)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fsPromises.writeFile(logoPath, buffer)

  // Relativen Pfad in DB speichern
  const relativePath = path.relative(process.cwd(), logoPath)
  await db
    .from('berichts_vorlagen')
    .update({ logo_pfad: relativePath, geaendert_am: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({
    ok: true,
    logo_url: `/api/templates/${id}/logo`,
    logo_pfad: relativePath,
  })
}

// DELETE: Logo entfernen
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

  const { data: vorlage } = await db
    .from('berichts_vorlagen')
    .select('logo_pfad')
    .eq('id', id)
    .single()

  if (!vorlage) {
    return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 })
  }

  if (vorlage.logo_pfad) {
    const logoDir = path.join(TEMPLATE_UPLOAD_PATH, id)
    try {
      if (fs.existsSync(logoDir)) fs.rmSync(logoDir, { recursive: true })
    } catch { /* ignore */ }
  }

  await db
    .from('berichts_vorlagen')
    .update({ logo_pfad: null, geaendert_am: new Date().toISOString() })
    .eq('id', id)

  return new NextResponse(null, { status: 204 })
}
