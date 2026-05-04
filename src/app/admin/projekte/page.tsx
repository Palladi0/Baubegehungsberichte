import { redirect } from 'next/navigation'
import { createServerActionClient } from '@/lib/supabase-server'
import { ProjektlisteCard } from '@/components/projekte/ProjektlisteCard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Projektverwaltung · Baubegehungsberichte',
  description: 'Übersicht aller Bauprojekte.',
}

export default async function AdminProjektePage() {
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Projektverwaltung
        </h1>
        <p className="text-sm text-muted-foreground">
          Lege Bauprojekte an, weise Mitarbeiter zu und verwalte Stammdaten.
        </p>
      </div>
      <ProjektlisteCard />
    </main>
  )
}
