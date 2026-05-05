import Link from 'next/link'
import { createServerActionClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { LogoutButton } from './LogoutButton'

export async function Navigation() {
  const supabase = await createServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const service = createServiceClient()
  const { data: profile } = await service
    .from('nutzer_profile')
    .select('rolle')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.rolle === 'admin'

  return (
    <header className="border-b bg-background">
      <nav
        className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
        aria-label="Hauptnavigation"
      >
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">
            Baubegehungsberichte
          </Link>
          <div className="hidden items-center gap-4 text-sm sm:flex">
            <Link
              href="/berichte"
              className="text-muted-foreground hover:text-foreground"
            >
              Berichte
            </Link>
            <Link
              href="/begehungen"
              className="text-muted-foreground hover:text-foreground"
            >
              Begehungen
            </Link>
            <Link
              href={isAdmin ? '/admin/projekte' : '/projekte'}
              className="text-muted-foreground hover:text-foreground"
            >
              Projekte
            </Link>
            {isAdmin && (
              <>
                <Link
                  href="/admin/benutzer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Benutzer
                </Link>
                <Link
                  href="/admin/whatsapp"
                  className="text-muted-foreground hover:text-foreground"
                >
                  WhatsApp
                </Link>
              </>
            )}
            <Link
              href="/profil"
              className="text-muted-foreground hover:text-foreground"
            >
              Profil
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="hidden text-sm text-muted-foreground sm:inline"
            aria-label="Eingeloggt als"
          >
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </nav>
    </header>
  )
}
