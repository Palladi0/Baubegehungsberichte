import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PUT: Dieses Template als Standard markieren (alle anderen → false)
export async function PUT(
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
    .select('id')
    .eq('id', id)
    .single()

  if (!vorlage) {
    return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 })
  }

  // Alle anderen zurücksetzen, dann dieses setzen (zwei Queries statt Transaction)
  await db.from('berichts_vorlagen').update({ ist_standard: false }).neq('id', id)

  const { error } = await db
    .from('berichts_vorlagen')
    .update({ ist_standard: true, geaendert_am: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
