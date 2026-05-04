import { redirect, notFound } from 'next/navigation'
import { createServerActionClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { VorlagenEditor } from '@/components/vorlagen/VorlagenEditor'
import type { VorlageConfig } from '@/types/berichte'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data } = await db.from('berichts_vorlagen').select('name').eq('id', id).single()
  return { title: `${data?.name ?? 'Vorlage'} bearbeiten · Baubegehungsberichte` }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export default async function VorlageBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createServerActionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('nutzer_profile')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv || profile.rolle !== 'admin') redirect('/')

  const { id } = await params
  const db = createServiceClient()
  const { data: vorlage } = await db
    .from('berichts_vorlagen')
    .select('*')
    .eq('id', id)
    .single()

  if (!vorlage) notFound()

  const initialValues: Partial<VorlageConfig> = {
    ...vorlage,
    logo_url: vorlage.logo_pfad ? `${APP_URL}/api/templates/${id}/logo` : null,
  }

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
        <h1 className="text-2xl font-bold tracking-tight">
          Vorlage bearbeiten: {vorlage.name}
        </h1>
      </div>

      <VorlagenEditor initialValues={initialValues} vorlageId={id} />
    </main>
  )
}
