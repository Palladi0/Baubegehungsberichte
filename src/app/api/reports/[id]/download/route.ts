import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()

  const { data: bericht } = await service
    .from('berichte')
    .select('projekt_id, begehungs_datum, pdf_pfad, pdf_generiert_am')
    .eq('id', id)
    .single()

  if (!bericht) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }

  if (auth.role !== 'admin') {
    const { data: pm } = await service
      .from('projekt_mitarbeiter')
      .select('nutzer_id')
      .eq('projekt_id', bericht.projekt_id)
      .eq('nutzer_id', auth.userId)
      .maybeSingle()

    if (!pm) {
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
    }
  }

  if (!bericht.pdf_pfad) {
    return NextResponse.json(
      { error: 'Kein PDF vorhanden. Bitte zuerst exportieren.' },
      { status: 404 }
    )
  }

  if (!fs.existsSync(bericht.pdf_pfad)) {
    return NextResponse.json(
      { error: 'PDF-Datei nicht gefunden. Bitte erneut exportieren.' },
      { status: 404 }
    )
  }

  // Projektnummer für den Dateinamen aus der verknüpften Tabelle laden
  const { data: projekt } = await service
    .from('projekte')
    .select('nummer')
    .eq('id', bericht.projekt_id)
    .single()

  const datumStr = bericht.begehungs_datum.slice(0, 10)
  const kuerzel = (projekt?.nummer ?? 'PROJEKT').replace(/[^a-zA-Z0-9-_]/g, '_')
  const dateiname = `${kuerzel}_Begehung_${datumStr}.pdf`

  const pdfBuffer = fs.readFileSync(bericht.pdf_pfad)

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${dateiname}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
