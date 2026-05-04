import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'
import type { BerichtsSnapshot, VorlageSnapshot } from '@/types/berichte'
import { renderBerichtHTML } from '@/lib/bericht-renderer'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const versionNrParam = searchParams.get('version')

  const service = createServiceClient()

  const { data: bericht } = await service
    .from('berichte')
    .select('projekt_id, aktuelle_version_nr, vorlage_id')
    .eq('id', id)
    .single()

  if (!bericht) {
    return new NextResponse('Bericht nicht gefunden', { status: 404 })
  }

  if (auth.role !== 'admin') {
    const { data: pm } = await service
      .from('projekt_mitarbeiter')
      .select('nutzer_id')
      .eq('projekt_id', bericht.projekt_id)
      .eq('nutzer_id', auth.userId)
      .maybeSingle()

    if (!pm) {
      return new NextResponse('Zugriff verweigert', { status: 403 })
    }
  }

  const zielVersionNr = versionNrParam
    ? parseInt(versionNrParam, 10)
    : (bericht as Record<string, unknown>).aktuelle_version_nr as number

  const { data: version } = await service
    .from('berichts_versionen')
    .select('inhalt')
    .eq('bericht_id', id)
    .eq('version_nr', zielVersionNr)
    .single()

  if (!version) {
    return new NextResponse('Version nicht gefunden', { status: 404 })
  }

  // Template laden (vorlage_id aus berichte, Fallback: Standard-Template)
  const vorlageId = (bericht as Record<string, unknown>).vorlage_id as string | null
  let vorlage: (VorlageSnapshot & { logo_url?: string | null }) | null = null

  const templateQuery = vorlageId
    ? service.from('berichts_vorlagen').select('*').eq('id', vorlageId).single()
    : service.from('berichts_vorlagen').select('*').eq('ist_standard', true).single()

  const { data: templateData } = await templateQuery

  if (templateData) {
    vorlage = {
      ...templateData,
      logo_url: templateData.logo_pfad ? `${APP_URL}/api/templates/${templateData.id}/logo` : null,
    } as VorlageSnapshot & { logo_url?: string | null }
  }

  const html = renderBerichtHTML(version.inhalt as BerichtsSnapshot, vorlage)

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
