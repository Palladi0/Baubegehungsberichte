import { redirect } from 'next/navigation'
import { createServerActionClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { VorlagenEditor } from '@/components/vorlagen/VorlagenEditor'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Neue Vorlage · Baubegehungsberichte',
}

export default async function NeueVorlagePage() {
  const supabase = await createServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('nutzer_profile')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv || profile.rolle !== 'admin') redirect('/')

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 space-y-1">
        <Link
          href="/admin/vorlagen"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zu Vorlagen
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Neue Vorlage erstellen</h1>
      </div>

      <VorlagenEditor />
    </main>
  )
}
