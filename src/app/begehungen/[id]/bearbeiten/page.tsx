import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'
import { BegehungsFormular } from '@/components/begehungen/BegehungsFormular'
import type { BegehungEintrag, ProjektOption } from '@/components/begehungen/types'

export const dynamic = 'force-dynamic'

async function ladeBegehung(id: string): Promise<BegehungEintrag | null> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('begehungen')
    .select(`
      id, datum, uhrzeit, wetterbedingungen, temperatur,
      leistungsstand, vorkommnisse, massnahmen, bemerkungen,
      status, erstellt_am, aktualisiert_am,
      projekt:projekte(id, name, kuerzel),
      bearbeiter:nutzer_profile(id, email),
      teilnehmer:begehung_teilnehmer(id, name, rolle)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  const d = data as Record<string, unknown>
  const projekt = d.projekt as { id: string; name: string; kuerzel: string } | null
  const bearbeiter = d.bearbeiter as { id: string; email: string } | null

  return {
    id: d.id as string,
    projekt_id: projekt?.id ?? '',
    projekt_name: projekt?.name ?? '',
    projekt_kuerzel: projekt?.kuerzel ?? '',
    bearbeiter_id: bearbeiter?.id ?? '',
    bearbeiter_email: bearbeiter?.email ?? '',
    datum: d.datum as string,
    uhrzeit: (d.uhrzeit as string)?.slice(0, 5),
    wetterbedingungen: (d.wetterbedingungen as BegehungEintrag['wetterbedingungen']) ?? null,
    temperatur: (d.temperatur as number) ?? null,
    leistungsstand: (d.leistungsstand as string) ?? null,
    vorkommnisse: (d.vorkommnisse as string) ?? null,
    massnahmen: (d.massnahmen as string) ?? null,
    bemerkungen: (d.bemerkungen as string) ?? null,
    status: d.status as BegehungEintrag['status'],
    teilnehmer: (d.teilnehmer as BegehungEintrag['teilnehmer']) ?? [],
    erstellt_am: d.erstellt_am as string,
    aktualisiert_am: d.aktualisiert_am as string,
  }
}

async function ladeProjekteDesMitarbeiters(
  userId: string,
  rolle: string
): Promise<ProjektOption[]> {
  const service = createServiceClient()

  if (rolle === 'admin') {
    const { data } = await service
      .from('projekte')
      .select('id, name, kuerzel, adresse, lat, lon')
      .is('archived_at', null)
      .order('name')
      .limit(500)
    return (data ?? []) as ProjektOption[]
  }

  const { data: pm } = await service
    .from('projekt_mitarbeiter')
    .select('projekt_id')
    .eq('nutzer_id', userId)

  const ids = (pm ?? []).map((r: { projekt_id: string }) => r.projekt_id)
  if (ids.length === 0) return []

  const { data } = await service
    .from('projekte')
    .select('id, name, kuerzel, adresse, lat, lon')
    .in('id', ids)
    .is('archived_at', null)
    .order('name')
    .limit(500)

  return (data ?? []) as ProjektOption[]
}

export default async function BegehungBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const auth = await requireAuth()
  if (!auth.ok) {
    redirect('/login')
  }

  const { id } = await params
  const [begehung, projekte] = await Promise.all([
    ladeBegehung(id),
    ladeProjekteDesMitarbeiters(auth.userId, auth.role),
  ])

  if (!begehung) {
    notFound()
  }

  if (auth.role !== 'admin' && begehung.bearbeiter_id !== auth.userId) {
    redirect('/begehungen')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground">
          <Link href="/begehungen">
            <ChevronLeft className="h-4 w-4" />
            Zurück zur Übersicht
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Begehung bearbeiten
        </h1>
        <p className="text-sm text-muted-foreground">
          {begehung.projekt_name} · {new Date(begehung.datum).toLocaleDateString('de-DE', { dateStyle: 'medium' })}
        </p>
      </div>

      <BegehungsFormular
        begehungId={id}
        initialDaten={begehung}
        projekte={projekte}
      />
    </main>
  )
}
