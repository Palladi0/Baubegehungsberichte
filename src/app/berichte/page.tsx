import { redirect } from 'next/navigation'
import { createServerActionClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { BerichteDashboard } from '@/components/berichte/BerichteDashboard'

export default async function BerichtePage() {
  const supabase = await createServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('nutzer_profile')
    .select('rolle')
    .eq('id', user.id)
    .single()

  const userRole = profile?.rolle ?? 'mitarbeiter'
  const service = createServiceClient()

  // Projekte für Filter-Dropdown laden
  let projekte: { id: string; name: string; kuerzel: string }[] = []

  if (userRole === 'admin') {
    const { data } = await service
      .from('projekte')
      .select('id, name, kuerzel')
      .is('archived_at', null)
      .order('name', { ascending: true })
      .limit(500)
    projekte = data ?? []
  } else {
    const { data: pm } = await service
      .from('projekt_mitarbeiter')
      .select('projekt_id')
      .eq('nutzer_id', user.id)

    const projektIds = (pm ?? []).map((p) => p.projekt_id)
    if (projektIds.length > 0) {
      const { data } = await service
        .from('projekte')
        .select('id, name, kuerzel')
        .in('id', projektIds)
        .is('archived_at', null)
        .order('name', { ascending: true })
        .limit(500)
      projekte = data ?? []
    }
  }

  return (
    <BerichteDashboard
      projekte={projekte}
      userId={user.id}
      userRole={userRole}
    />
  )
}
