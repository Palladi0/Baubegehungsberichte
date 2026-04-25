import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Rate Limiting: 20 KI-Extraktionen pro Stunde pro Nutzer.
// Deckt ~5 Begehungen × 4 Extraktionsversuche (ca. 2 DIN-A4-Seiten je Begehung).
const rateLimitMap = new Map<string, number[]>()
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 Stunde
const RATE_MAX = 20

function checkRateLimit(userId: string): { erlaubt: boolean; verbleibend: number } {
  const jetzt = Date.now()
  const zeitstempel = (rateLimitMap.get(userId) ?? []).filter(
    (ts) => jetzt - ts < RATE_WINDOW_MS
  )
  if (zeitstempel.length >= RATE_MAX) {
    rateLimitMap.set(userId, zeitstempel)
    return { erlaubt: false, verbleibend: 0 }
  }
  zeitstempel.push(jetzt)
  rateLimitMap.set(userId, zeitstempel)
  return { erlaubt: true, verbleibend: RATE_MAX - zeitstempel.length }
}

const RequestSchema = z.object({
  freitext: z.string().min(10, 'Text zu kurz für Extraktion'),
})

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Du bist ein Assistent, der Baustellenbegehungs-Protokolle analysiert.
Extrahiere strukturierte Informationen aus dem Text und gib ausschließlich valides JSON zurück — keine Erklärungen, keine Kommentare.

Extrahiere NUR diese Felder (leer lassen / null wenn nicht erkennbar):
- teilnehmer: Array von { name: string, rolle: string } (Personen, die an der Begehung teilgenommen haben)
- leistungsstand: string (aktueller Baufortschritt, z. B. "Rohbau ca. 60% fertig")
- vorkommnisse: string (besondere Vorkommnisse, Mängel, Probleme)
- massnahmen: string (nächste Schritte, Maßnahmen, Aufgaben)
- bemerkungen: string (sonstige Bemerkungen)

WICHTIG: Extrahiere KEINE Wetterdaten oder Temperaturen.
Gib ausschließlich das JSON-Objekt zurück, kein Markdown, keine Codeblöcke.`

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { erlaubt, verbleibend } = checkRateLimit(auth.userId)
  if (!erlaubt) {
    return NextResponse.json(
      { error: 'Zu viele KI-Extraktionen. Limit: 20 pro Stunde. Bitte später erneut versuchen.' },
      {
        status: 429,
        headers: { 'Retry-After': '3600', 'X-RateLimit-Limit': String(RATE_MAX) },
      }
    )
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analysiere folgenden Text:\n\n${parsed.data.freitext}`,
        },
      ],
    })

    const rawText =
      message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''

    let extraktion: Record<string, unknown> = {}
    try {
      extraktion = JSON.parse(rawText)
    } catch {
      return NextResponse.json(
        { error: 'KI-Antwort konnte nicht verarbeitet werden', leerErgebnis: true },
        { status: 200 }
      )
    }

    const hatInhalt =
      (extraktion.teilnehmer && Array.isArray(extraktion.teilnehmer) && extraktion.teilnehmer.length > 0) ||
      extraktion.leistungsstand ||
      extraktion.vorkommnisse ||
      extraktion.massnahmen ||
      extraktion.bemerkungen

    const rateLimitHeaders = { 'X-RateLimit-Remaining': String(verbleibend) }

    if (!hatInhalt) {
      return NextResponse.json({ leerErgebnis: true, extraktion: {} }, { headers: rateLimitHeaders })
    }

    return NextResponse.json({ leerErgebnis: false, extraktion }, { headers: rateLimitHeaders })
  } catch (err) {
    console.error('Claude API Fehler:', err)
    return NextResponse.json(
      { error: 'KI-Extraktion fehlgeschlagen. Bitte Felder manuell ausfüllen.' },
      { status: 503 }
    )
  }
}
