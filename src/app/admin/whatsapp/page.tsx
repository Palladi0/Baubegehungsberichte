import { redirect } from 'next/navigation'
import { createServerActionClient } from '@/lib/supabase-server'
import { WhatsAppNummernCard } from '@/components/whatsapp/WhatsAppNummernCard'
import { WhatsAppNachrichtenCard } from '@/components/whatsapp/WhatsAppNachrichtenCard'
import { WebhookUrlCard } from '@/components/whatsapp/WebhookUrlCard'
import { TranskriptionsLogCard } from '@/components/whatsapp/TranskriptionsLogCard'
import { ZuordnungsCard } from '@/components/whatsapp/ZuordnungsCard'
import { BetriebsmodusCard } from '@/components/whatsapp/BetriebsmodusCard'
import { TemplateStatusCard } from '@/components/whatsapp/TemplateStatusCard'
import { MigrationsChecklisteCard } from '@/components/whatsapp/MigrationsChecklisteCard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'WhatsApp-Integration · Baubegehungsberichte',
  description: 'Verwalte Mitarbeiter-Telefonnummern und überwache eingehende WhatsApp-Nachrichten.',
}

export default async function AdminWhatsAppPage() {
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
          WhatsApp-Integration
        </h1>
        <p className="text-sm text-muted-foreground">
          Verwalte registrierte Mitarbeiter-Nummern und überwache eingehende Nachrichten.
        </p>
      </div>

      <div className="space-y-6">
        <WebhookUrlCard />
        <WhatsAppNummernCard />
        <ZuordnungsCard />
        <WhatsAppNachrichtenCard />
        <TranskriptionsLogCard />

        <div className="pt-4">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Business API Migration (PROJ-11)
          </h2>
          <div className="space-y-6">
            <BetriebsmodusCard />
            <TemplateStatusCard />
            <MigrationsChecklisteCard />
          </div>
        </div>
      </div>
    </main>
  )
}
