'use client'

import { useEffect, useState, useMemo } from 'react'
import { Loader2, AlertCircle, FolderOpen, Search, Archive } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

type ProjektKurzinfo = {
  id: string
  name: string
  nummer: string
  kuerzel: string
  auftraggeber: string | null
  adresse: string | null
  start_datum: string | null
  end_datum: string | null
  archived_at: string | null
}

function formatiereDatum(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' })
  } catch {
    return '—'
  }
}

export default function MitarbeiterProjektePage() {
  const [projekte, setProjekte] = useState<ProjektKurzinfo[]>([])
  const [istLade, setIstLade] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [suche, setSuche] = useState('')
  const [zeigeArchiviert, setZeigeArchiviert] = useState(false)

  async function ladeProjekte(archiviert: boolean) {
    setIstLade(true)
    setLadeFehler(null)
    try {
      const antwort = await fetch(`/api/projekte?archiviert=${archiviert}`, {
        cache: 'no-store',
      })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Projekte konnten nicht geladen werden.')
      }
      const daten: ProjektKurzinfo[] = await antwort.json()
      setProjekte(daten)
    } catch (fehler) {
      setLadeFehler(
        fehler instanceof Error ? fehler.message : 'Projekte konnten nicht geladen werden.'
      )
    } finally {
      setIstLade(false)
    }
  }

  useEffect(() => {
    ladeProjekte(zeigeArchiviert)
  }, [zeigeArchiviert])

  const gefilterteProjekte = useMemo(() => {
    if (!suche.trim()) return projekte
    const q = suche.toLowerCase()
    return projekte.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.nummer.toLowerCase().includes(q) ||
        p.kuerzel.toLowerCase().includes(q)
    )
  }, [projekte, suche])

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Meine Projekte
        </h1>
        <p className="text-sm text-muted-foreground">
          Übersicht der dir zugeordneten Bauprojekte.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projekte</CardTitle>
          <CardDescription>
            Nur Projekte, denen du zugeordnet bist, werden angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name, Nummer oder Kürzel …"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                className="pl-9"
                aria-label="Projekte durchsuchen"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="archiviert-toggle"
                checked={zeigeArchiviert}
                onCheckedChange={setZeigeArchiviert}
                aria-label="Archivierte Projekte anzeigen"
              />
              <Label htmlFor="archiviert-toggle" className="flex items-center gap-1.5 cursor-pointer">
                <Archive className="h-3.5 w-3.5" />
                Archiviert
              </Label>
            </div>
          </div>

          {istLade && (
            <div
              className="flex items-center justify-center py-16 text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Projekte werden geladen …
            </div>
          )}

          {!istLade && ladeFehler && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{ladeFehler}</span>
                <Button variant="outline" size="sm" onClick={() => ladeProjekte(zeigeArchiviert)}>
                  Erneut versuchen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!istLade && !ladeFehler && gefilterteProjekte.length === 0 && (
            <div className="rounded-md border border-dashed py-12 text-center">
              <FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {suche
                  ? 'Keine Projekte für diese Suche gefunden.'
                  : zeigeArchiviert
                    ? 'Keine archivierten Projekte vorhanden.'
                    : 'Du bist derzeit keinem Projekt zugeordnet. Wende dich an deinen Administrator.'}
              </p>
            </div>
          )}

          {!istLade && !ladeFehler && gefilterteProjekte.length > 0 && (
            <div className="space-y-3">
              {gefilterteProjekte.map((projekt) => (
                <div
                  key={projekt.id}
                  className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{projekt.name}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          #{projekt.kuerzel}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Nr. {projekt.nummer}
                        {projekt.auftraggeber && ` · ${projekt.auftraggeber}`}
                      </p>
                    </div>
                    <Badge variant={projekt.archived_at ? 'secondary' : 'outline'}>
                      {projekt.archived_at ? 'Archiviert' : 'Aktiv'}
                    </Badge>
                  </div>
                  {projekt.adresse && (
                    <p className="mt-2 text-xs text-muted-foreground">{projekt.adresse}</p>
                  )}
                  {(projekt.start_datum || projekt.end_datum) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatiereDatum(projekt.start_datum)} –{' '}
                      {formatiereDatum(projekt.end_datum)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
