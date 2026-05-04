import { redirect } from 'next/navigation'
import { createServerActionClient } from '@/lib/supabase-server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PasswortAendernCard } from '@/components/benutzer/PasswortAendernCard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Profil · Baubegehungsberichte',
  description: 'Verwalte dein Profil und ändere dein Passwort.',
}

export default async function ProfilPage() {
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

  const rolleAnzeige = profile.rolle === 'admin' ? 'Admin' : 'Mitarbeiter'

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profil</h1>
        <p className="text-sm text-muted-foreground">
          Deine Kontoinformationen und Sicherheitseinstellungen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kontoinformationen</CardTitle>
          <CardDescription>
            Diese Angaben werden vom Administrator verwaltet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                E-Mail
              </dt>
              <dd className="mt-1 break-all text-sm font-medium">
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Rolle
              </dt>
              <dd className="mt-1">
                <Badge
                  variant={profile.rolle === 'admin' ? 'default' : 'secondary'}
                >
                  {rolleAnzeige}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <PasswortAendernCard />
    </main>
  )
}
