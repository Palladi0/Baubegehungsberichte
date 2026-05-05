import { redirect } from 'next/navigation'
import { createServerActionClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { VorlagenListe } from '@/components/vorlagen/VorlagenListe'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Berichtsvorlagen · Baubegehungsberichte',
  description: 'Verwalte Berichtsvorlagen für deine Berichte.',
}

export default async function VorlagenPage() {
  const supabase = await createServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const { data: profile } = await service
    .from('nutzer_profile')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv || profile.rolle !== 'admin') redirect('/')

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <VorlagenListe />
    </main>
  )
}
