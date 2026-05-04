import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ClipboardList } from 'lucide-react'
import { createServerActionClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { ProjektBearbeitenForm } from '@/components/projekte/ProjektBearbeitenForm'
import { ProjektMitarbeiterCard } from '@/components/projekte/ProjektMitarbeiterCard'
import { Badge } from '@/components/ui/badge'
import type { ProjektEintrag } from '@/components/projekte/types'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const service = createServiceClient()
  const { data } = await service.from('projekte').select('name').eq('id', id).single()
  return {
    title: data?.name
      ? `${data.name} · Baubegehungsberichte`
      : 'Projektdetails · Baubegehungsberichte',
  }
}

export default async function AdminProjektDetailPage({ params }: Props) {
  const supabase = await createServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('nutzer_profile')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.aktiv) {
    redirect('/login')
  }

  if (profile.rolle !== 'admin') {
    redirect('/')
  }

  const { id } = await params
  const service = createServiceClient()

  const { data: projekt, error } = await service
    .from('projekte')
    .select(
      'id, name, nummer, kuerzel, auftraggeber, bauherr, adresse, start_datum, end_datum, beschreibung, archived_at, erstellt_am, aktualisiert_am'
    )
    .eq('id', id)
    .single()

  if (error || !projekt) {
    notFound()
  }

  const p = projekt as ProjektEintrag

  // Anzahl der Begehungsberichte für dieses Projekt
  const { count: begehungsAnzahl } = await service
    .from('begehungen')
    .select('id', { count: 'exact', head: true })
    .eq('projekt_id', id)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <Link
          href="/admin/projekte"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          aria-label="Zurück zur Projektliste"
        >
          <ChevronLeft className="h-4 w-4" />
          Alle Projekte
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.name}</h1>
          <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm">
            #{p.kuerzel}
          </code>
          {p.archived_at && <Badge variant="secondary">Archiviert</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Projektnummer: {p.nummer}</p>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <ClipboardList className="h-4 w-4" />
          <span>
            {begehungsAnzahl ?? 0}{' '}
            {(begehungsAnzahl ?? 0) === 1 ? 'Begehungsbericht' : 'Begehungsberichte'}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <ProjektBearbeitenForm projekt={p} />
        <ProjektMitarbeiterCard projektId={id} istArchiviert={p.archived_at !== null} />
      </div>
    </main>
  )
}
