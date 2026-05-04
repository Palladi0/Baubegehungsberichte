'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, FolderOpen, Plus, Search, Archive, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { NeueProjektDialog } from './NeueProjektDialog'
import type { ProjektEintrag } from './types'

function formatiereDatum(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' })
  } catch {
    return '—'
  }
}

export function ProjektlisteCard() {
  const router = useRouter()
  const [projekte, setProjekte] = useState<ProjektEintrag[]>([])
  const [istLade, setIstLade] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [suche, setSuche] = useState('')
  const [zeigeArchiviert, setZeigeArchiviert] = useState(false)
  const [neuesProjektOffen, setNeuesProjektOffen] = useState(false)

  const ladeProjekte = useCallback(async (archiviert: boolean) => {
    setIstLade(true)
    setLadeFehler(null)
    try {
      const antwort = await fetch(
        `/api/admin/projekte?archiviert=${archiviert}`,
        { cache: 'no-store' }
      )
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Projekte konnten nicht geladen werden.')
      }
      const daten: ProjektEintrag[] = await antwort.json()
      setProjekte(daten)
    } catch (fehler) {
      setLadeFehler(
        fehler instanceof Error ? fehler.message : 'Projekte konnten nicht geladen werden.'
      )
    } finally {
      setIstLade(false)
    }
  }, [])

  useEffect(() => {
    ladeProjekte(zeigeArchiviert)
  }, [ladeProjekte, zeigeArchiviert])

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
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Projekte</CardTitle>
          <CardDescription>
            Übersicht aller Bauprojekte. Klicke auf ein Projekt für Details und Mitarbeiterzuordnung.
          </CardDescription>
        </div>
        <Button
          onClick={() => setNeuesProjektOffen(true)}
          className="sm:shrink-0"
          aria-label="Neues Projekt anlegen"
        >
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
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
                  : 'Noch keine Projekte vorhanden. Lege das erste Projekt an.'}
            </p>
          </div>
        )}

        {!istLade && !ladeFehler && gefilterteProjekte.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Kürzel</TableHead>
                  <TableHead className="hidden sm:table-cell">Auftraggeber</TableHead>
                  <TableHead className="hidden lg:table-cell">Start</TableHead>
                  <TableHead className="hidden lg:table-cell">Ende</TableHead>
                  <TableHead className="hidden md:table-cell">Team</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gefilterteProjekte.map((projekt) => (
                  <TableRow
                    key={projekt.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/projekte/${projekt.id}`)}
                    role="link"
                    aria-label={`Projekt ${projekt.name} öffnen`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        router.push(`/admin/projekte/${projekt.id}`)
                      }
                    }}
                  >
                    <TableCell>
                      <div className="font-medium">{projekt.name}</div>
                      <div className="text-xs text-muted-foreground">{projekt.nummer}</div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {projekt.kuerzel}
                      </code>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {projekt.auftraggeber ?? '—'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatiereDatum(projekt.start_datum)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatiereDatum(projekt.end_datum)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {projekt.mitarbeiter_anzahl ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {projekt.archived_at ? (
                        <Badge variant="secondary">Archiviert</Badge>
                      ) : (
                        <Badge variant="outline">Aktiv</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <NeueProjektDialog
        offen={neuesProjektOffen}
        onOffenChange={setNeuesProjektOffen}
        onErfolg={(neuesProjekt) => {
          setNeuesProjektOffen(false)
          toast.success(`Projekt „${neuesProjekt.name}" wurde angelegt.`)
          router.push(`/admin/projekte/${neuesProjekt.id}`)
        }}
      />
    </Card>
  )
}
