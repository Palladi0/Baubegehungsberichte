'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, AlertCircle, UserPlus, UserMinus, Users } from 'lucide-react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProjektMitarbeiter, NutzerOption } from './types'

type Props = {
  projektId: string
  istArchiviert: boolean
}

export function ProjektMitarbeiterCard({ projektId, istArchiviert }: Props) {
  const [mitarbeiter, setMitarbeiter] = useState<ProjektMitarbeiter[]>([])
  const [istLade, setIstLade] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [hinzufuegenOffen, setHinzufuegenOffen] = useState(false)
  const [verfuegbareNutzer, setVerfuegbareNutzer] = useState<NutzerOption[]>([])
  const [ausgewaehlterNutzer, setAusgewaehlterNutzer] = useState<string>('')
  const [speichernLade, setSpeichernLade] = useState(false)
  const [entfernenLadeId, setEntfernenLadeId] = useState<string | null>(null)

  const ladeMitarbeiter = useCallback(async () => {
    setIstLade(true)
    setLadeFehler(null)
    try {
      const antwort = await fetch(`/api/admin/projekte/${projektId}/mitarbeiter`, {
        cache: 'no-store',
      })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Mitarbeiter konnten nicht geladen werden.')
      }
      const daten: ProjektMitarbeiter[] = await antwort.json()
      setMitarbeiter(daten)
    } catch (fehler) {
      setLadeFehler(
        fehler instanceof Error ? fehler.message : 'Mitarbeiter konnten nicht geladen werden.'
      )
    } finally {
      setIstLade(false)
    }
  }, [projektId])

  useEffect(() => {
    ladeMitarbeiter()
  }, [ladeMitarbeiter])

  async function oeffneHinzufuegenDialog() {
    try {
      const antwort = await fetch('/api/admin/benutzer', { cache: 'no-store' })
      if (!antwort.ok) return
      const alleNutzer: NutzerOption[] = await antwort.json()
      const bereitsZugeordnet = new Set(mitarbeiter.map((m) => m.id))
      setVerfuegbareNutzer(
        alleNutzer.filter((n) => !bereitsZugeordnet.has(n.id))
      )
    } catch {
      setVerfuegbareNutzer([])
    }
    setAusgewaehlterNutzer('')
    setHinzufuegenOffen(true)
  }

  async function mitarbeiterHinzufuegen() {
    if (!ausgewaehlterNutzer) return
    setSpeichernLade(true)
    try {
      const antwort = await fetch(`/api/admin/projekte/${projektId}/mitarbeiter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nutzer_id: ausgewaehlterNutzer }),
      })
      const body = await antwort.json()
      if (!antwort.ok) {
        toast.error(body.error ?? 'Mitarbeiter konnte nicht hinzugefügt werden.')
        return
      }
      toast.success('Mitarbeiter wurde dem Projekt zugeordnet.')
      setHinzufuegenOffen(false)
      await ladeMitarbeiter()
    } catch {
      toast.error('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setSpeichernLade(false)
    }
  }

  async function mitarbeiterEntfernen(nutzer: ProjektMitarbeiter) {
    setEntfernenLadeId(nutzer.id)
    try {
      const antwort = await fetch(
        `/api/admin/projekte/${projektId}/mitarbeiter/${nutzer.id}`,
        { method: 'DELETE' }
      )
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        toast.error(body.error ?? 'Mitarbeiter konnte nicht entfernt werden.')
        return
      }
      toast.success(`${nutzer.email} wurde aus dem Projekt entfernt.`)
      await ladeMitarbeiter()
    } catch {
      toast.error('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setEntfernenLadeId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team ({mitarbeiter.length})
            </CardTitle>
            <CardDescription>
              Dem Projekt zugeordnete Mitarbeiter.
            </CardDescription>
          </div>
          {!istArchiviert && (
            <Button
              size="sm"
              onClick={oeffneHinzufuegenDialog}
              className="sm:shrink-0"
              aria-label="Mitarbeiter hinzufügen"
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              Mitarbeiter hinzufügen
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {istLade && (
            <div
              className="flex items-center justify-center py-10 text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Wird geladen …
            </div>
          )}

          {!istLade && ladeFehler && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{ladeFehler}</span>
                <Button variant="outline" size="sm" onClick={ladeMitarbeiter}>
                  Erneut versuchen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!istLade && !ladeFehler && mitarbeiter.length === 0 && (
            <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              Noch keine Mitarbeiter zugeordnet.
            </div>
          )}

          {!istLade && !ladeFehler && mitarbeiter.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Status</TableHead>
                  {!istArchiviert && <TableHead className="text-right">Aktion</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mitarbeiter.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={m.rolle === 'admin' ? 'default' : 'secondary'}>
                        {m.rolle === 'admin' ? 'Admin' : 'Mitarbeiter'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.aktiv ? 'outline' : 'destructive'}>
                        {m.aktiv ? 'Aktiv' : 'Deaktiviert'}
                      </Badge>
                    </TableCell>
                    {!istArchiviert && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => mitarbeiterEntfernen(m)}
                          disabled={entfernenLadeId === m.id}
                          aria-label={`${m.email} aus dem Projekt entfernen`}
                        >
                          {entfernenLadeId === m.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Entfernen
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={hinzufuegenOffen} onOpenChange={setHinzufuegenOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mitarbeiter hinzufügen</DialogTitle>
            <DialogDescription>
              Wähle einen Nutzer aus, der diesem Projekt zugeordnet werden soll.
            </DialogDescription>
          </DialogHeader>

          {verfuegbareNutzer.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Alle vorhandenen Nutzer sind bereits zugeordnet.
            </p>
          ) : (
            <Select value={ausgewaehlterNutzer} onValueChange={setAusgewaehlterNutzer}>
              <SelectTrigger aria-label="Nutzer auswählen">
                <SelectValue placeholder="Nutzer auswählen …" />
              </SelectTrigger>
              <SelectContent>
                {verfuegbareNutzer.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.email}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({n.rolle === 'admin' ? 'Admin' : 'Mitarbeiter'})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHinzufuegenOffen(false)}
              disabled={speichernLade}
            >
              Abbrechen
            </Button>
            <Button
              onClick={mitarbeiterHinzufuegen}
              disabled={!ausgewaehlterNutzer || speichernLade}
              aria-label="Mitarbeiter zuordnen"
            >
              {speichernLade && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Zuordnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
