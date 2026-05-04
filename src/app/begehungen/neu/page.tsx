import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'
import { BegehungsFormular } from '@/components/begehungen/BegehungsFormular'
import type { ProjektOption } from '@/components/begehungen/types'

export const dynamic = 'force-dynamic'

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

export default async function NeueBegehungPage() {
  const auth = await requireAuth()
  if (!auth.ok) {
    redirect('/login')
  }

  const projekte = await ladeProjekteDesMitarbeiters(auth.userId, auth.role)

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
          Neue Begehung
        </h1>
        <p className="text-sm text-muted-foreground">
          Baustellenbegehung erfassen und speichern.
        </p>
      </div>

      {projekte.length === 0 ? (
        <div className="rounded-md border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Du bist derzeit keinem Projekt zugeordnet. Wende dich an deinen Administrator.
          </p>
        </div>
      ) : (
        <BegehungsFormular projekte={projekte} />
      )}
    </main>
  )
}
