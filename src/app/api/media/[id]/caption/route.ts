import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'
import Anthropic from '@anthropic-ai/sdk'
import path from 'path'
import fs from 'fs/promises'

export const dynamic = 'force-dynamic'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'photos')

const client = new Anthropic()

const rateLimitMap = new Map<string, number[]>()
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 Stunde
const RATE_MAX = 10 // max. 10 KI-Analysen pro Nutzer pro Stunde

function checkRateLimit(userId: string): { erlaubt: boolean; verbleibend: number } {
  const jetzt = Date.now()
  const zeitstempel = (rateLimitMap.get(userId) ?? []).filter((ts) => jetzt - ts < RATE_WINDOW_MS)
  if (zeitstempel.length >= RATE_MAX) {
    rateLimitMap.set(userId, zeitstempel)
    return { erlaubt: false, verbleibend: 0 }
  }
  zeitstempel.push(jetzt)
  rateLimitMap.set(userId, zeitstempel)
  return { erlaubt: true, verbleibend: RATE_MAX - zeitstempel.length }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { erlaubt, verbleibend } = checkRateLimit(auth.userId)
  if (!erlaubt) {
    return NextResponse.json(
      { error: 'Rate-Limit erreicht. Maximal 10 KI-Analysen pro Stunde.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
    )
  }

  const { id } = await params

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: foto } = await service
    .from('fotos')
    .select('id, projekt_id, geloescht_am')
    .eq('id', id)
    .single()

  if (!foto || foto.geloescht_am) {
    return NextResponse.json({ error: 'Foto nicht gefunden.' }, { status: 404 })
  }

  // Access check
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

  const displayPath = path.join(UPLOAD_DIR, foto.id, 'display.jpg')
  let imageData: string
  try {
    const imageBuffer = await fs.readFile(displayPath)
    imageData = imageBuffer.toString('base64')
  } catch {
    return NextResponse.json({ error: 'Bilddatei nicht gefunden.' }, { status: 404 })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageData },
            },
            {
              type: 'text',
              text: 'Du bist ein Assistent für ein Architekturbüro. Beschreibe dieses Baustellenfoto in einem prägnanten deutschen Satz (max. 120 Zeichen) als Bildunterschrift für einen professionellen Baustellen-Begehungsbericht. Wenn kein Baumotiv erkennbar ist, antworte mit: "Bitte Beschreibung manuell hinzufügen."',
            },
          ],
        },
      ],
    })

    const vorschlag =
      message.content[0].type === 'text'
        ? message.content[0].text.trim()
        : 'Bitte Beschreibung manuell hinzufügen.'

    return NextResponse.json({ vorschlag }, { headers: { 'X-RateLimit-Remaining': String(verbleibend) } })
  } catch {
    return NextResponse.json(
      { error: 'KI-Analyse fehlgeschlagen. Bitte erneut versuchen.' },
      { status: 502 }
    )
  }
}
