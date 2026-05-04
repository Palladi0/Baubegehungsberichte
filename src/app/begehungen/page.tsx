'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Loader2,
  AlertCircle,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { BegehungEintrag } from '@/components/begehungen/types'

function formatiereDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

export default function BegehungenPage() {
  const [begehungen, setBegehungen] = useState<BegehungEintrag[]>([])
  const [istLade, setIstLade] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [loeschenId, setLoeschenId] = useState<string | null>(null)

  async function ladeBegehungen() {
    setIstLade(true)
    setLadeFehler(null)
    try {
      const res = await fetch('/api/begehungen', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Begehungen konnten nicht geladen werden.')
      }
      const daten: BegehungEintrag[] = await res.json()
      setBegehungen(daten)
    } catch (err) {
      setLadeFehler(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setIstLade(false)
    }
  }

  useEffect(() => {
    ladeBegehungen()
  }, [])

  async function handleLoeschen(id: string) {
    try {
      const res = await fetch(`/api/begehungen/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        toast.error('Begehung konnte nicht gelöscht werden.')
        return
      }
      toast.success('Begehung gelöscht.')
      setBegehungen((prev) => prev.filter((b) => b.id !== id))
    } catch {
      toast.error('Netzwerkfehler beim Löschen.')
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Begehungen
          </h1>
          <p className="text-sm text-muted-foreground">
            Baustellenbegehungen erfassen und verwalten.
          </p>
        </div>
        <Button asChild>
          <Link href="/begehungen/neu" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Neue Begehung
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alle Begehungen</CardTitle>
          <CardDescription>
            Entwürfe und fertige Begehungen sortiert nach Datum.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {istLade && (
            <div
              className="flex items-center justify-center py-16 text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Begehungen werden geladen …
            </div>
          )}

          {!istLade && ladeFehler && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{ladeFehler}</span>
                <Button variant="outline" size="sm" onClick={ladeBegehungen}>
                  Erneut versuchen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!istLade && !ladeFehler && begehungen.length === 0 && (
            <div className="rounded-md border border-dashed py-12 text-center">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Noch keine Begehungen vorhanden.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4 gap-1.5">
                <Link href="/begehungen/neu">
                  <Plus className="h-4 w-4" />
                  Erste Begehung anlegen
                </Link>
              </Button>
            </div>
          )}

          {!istLade && !ladeFehler && begehungen.length > 0 && (
            <div className="space-y-3">
              {begehungen.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{b.projekt_name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        #{b.projekt_kuerzel}
                      </code>
                      <Badge variant={b.status === 'Fertig' ? 'default' : 'secondary'}>
                        {b.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatiereDatum(b.datum)} · {b.uhrzeit?.slice(0, 5)} Uhr
                      {b.bearbeiter_email && ` · ${b.bearbeiter_email}`}
                    </p>
                    {b.teilnehmer.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {b.teilnehmer.map((t) => t.name).join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      aria-label="Begehung bearbeiten"
                    >
                      <Link href={`/begehungen/${b.id}/bearbeiten`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Begehung löschen"
                          onClick={() => setLoeschenId(b.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Begehung löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Die Begehung vom {formatiereDatum(b.datum)} wird unwiderruflich gelöscht.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setLoeschenId(null)}>
                            Abbrechen
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (loeschenId) handleLoeschen(loeschenId)
                              setLoeschenId(null)
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
