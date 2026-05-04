import { redirect } from 'next/navigation'
import { createServerActionClient } from '@/lib/supabase-server'
import { BenutzertabelleCard } from '@/components/benutzer/BenutzertabelleCard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Benutzerverwaltung · Baubegehungsberichte',
  description: 'Verwalte Nutzerkonten, Rollen und Passwörter.',
}

export default async function AdminBenutzerPage() {
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
          Benutzerverwaltung
        </h1>
        <p className="text-sm text-muted-foreground">
          Lege neue Nutzer an, verwalte Rollen und setze bei Bedarf Passwörter
          zurück.
        </p>
      </div>
      <BenutzertabelleCard eigeneId={user.id} />
    </main>
  )
}
