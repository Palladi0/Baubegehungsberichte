'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, KeyRound, UserX, UserCheck, AlertCircle, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { NeuenNutzerDialog } from './NeuenNutzerDialog'
import { PasswortZuruecksetzenDialog } from './PasswortZuruecksetzenDialog'
import { NutzerDeaktivierenDialog } from './NutzerDeaktivierenDialog'

export type NutzerEintrag = {
  id: string
  email: string
  rolle: 'admin' | 'mitarbeiter'
  aktiv: boolean
  fehlgeschlagene_versuche: number
  gesperrt_bis: string | null
  zuletzt_eingeloggt_am: string | null
}

type BenutzertabelleCardProps = {
  eigeneId: string
}

function formatiereDatum(iso: string | null): string {
  if (!iso) return '—'
  try {
    const datum = new Date(iso)
    return datum.toLocaleString('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

export function BenutzertabelleCard({ eigeneId }: BenutzertabelleCardProps) {
  const [nutzerListe, setNutzerListe] = useState<NutzerEintrag[]>([])
  const [istLade, setIstLade] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)

  const [neuerNutzerOffen, setNeuerNutzerOffen] = useState(false)
  const [passwortResetNutzer, setPasswortResetNutzer] = useState<NutzerEintrag | null>(
    null
  )
  const [deaktivierenNutzer, setDeaktivierenNutzer] = useState<NutzerEintrag | null>(
    null
  )
  const [aktiviereNutzerId, setAktiviereNutzerId] = useState<string | null>(null)

  const ladeNutzer = useCallback(async () => {
    setIstLade(true)
    setLadeFehler(null)
    try {
      const antwort = await fetch('/api/admin/benutzer', { cache: 'no-store' })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Nutzerliste konnte nicht geladen werden.')
      }
      const daten: NutzerEintrag[] = await antwort.json()
      setNutzerListe(daten)
    } catch (fehler) {
      const nachricht =
        fehler instanceof Error
          ? fehler.message
          : 'Nutzerliste konnte nicht geladen werden.'
      setLadeFehler(nachricht)
    } finally {
      setIstLade(false)
    }
  }, [])

  useEffect(() => {
    ladeNutzer()
  }, [ladeNutzer])

  async function aktiviereNutzer(nutzer: NutzerEintrag) {
    setAktiviereNutzerId(nutzer.id)
    try {
      const antwort = await fetch(`/api/admin/benutzer/${nutzer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktiv: true }),
      })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Nutzer konnte nicht aktiviert werden.')
      }
      toast.success(`${nutzer.email} wurde aktiviert.`)
      await ladeNutzer()
    } catch (fehler) {
      const nachricht =
        fehler instanceof Error
          ? fehler.message
          : 'Nutzer konnte nicht aktiviert werden.'
      toast.error(nachricht)
    } finally {
      setAktiviereNutzerId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Benutzerverwaltung</CardTitle>
          <CardDescription>
            Übersicht aller Nutzer. Rollen anlegen, Passwörter zurücksetzen oder
            Accounts deaktivieren.
          </CardDescription>
        </div>
        <Button
          onClick={() => setNeuerNutzerOffen(true)}
          className="sm:shrink-0"
          aria-label="Neuen Nutzer anlegen"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Neuen Nutzer anlegen
        </Button>
      </CardHeader>

      <CardContent>
        {istLade && (
          <div
            className="flex items-center justify-center py-16 text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Nutzer werden geladen...
          </div>
        )}

        {!istLade && ladeFehler && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{ladeFehler}</span>
              <Button variant="outline" size="sm" onClick={ladeNutzer}>
                Erneut versuchen
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!istLade && !ladeFehler && nutzerListe.length === 0 && (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            Noch keine Nutzer vorhanden. Lege den ersten Account über
            &bdquo;Neuen Nutzer anlegen&ldquo; an.
          </div>
        )}

        {!istLade && !ladeFehler && nutzerListe.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Zuletzt eingeloggt
                  </TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nutzerListe.map((nutzer) => {
                  const istEigener = nutzer.id === eigeneId
                  const istGesperrt =
                    nutzer.gesperrt_bis !== null &&
                    new Date(nutzer.gesperrt_bis) > new Date()

                  return (
                    <TableRow key={nutzer.id}>
                      <TableCell className="font-medium">
                        {nutzer.email}
                        {istEigener && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (Sie)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            nutzer.rolle === 'admin' ? 'default' : 'secondary'
                          }
                        >
                          {nutzer.rolle === 'admin' ? 'Admin' : 'Mitarbeiter'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!nutzer.aktiv ? (
                          <Badge variant="destructive">Deaktiviert</Badge>
                        ) : istGesperrt ? (
                          <Badge variant="outline">Gesperrt</Badge>
                        ) : (
                          <Badge variant="outline">Aktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatiereDatum(nutzer.zuletzt_eingeloggt_am)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPasswortResetNutzer(nutzer)}
                            aria-label={`Passwort für ${nutzer.email} zurücksetzen`}
                          >
                            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                            Passwort
                          </Button>
                          {nutzer.aktiv ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeaktivierenNutzer(nutzer)}
                              disabled={istEigener}
                              aria-label={`${nutzer.email} deaktivieren`}
                              title={
                                istEigener
                                  ? 'Der eigene Account kann nicht deaktiviert werden.'
                                  : undefined
                              }
                            >
                              <UserX className="mr-1.5 h-3.5 w-3.5" />
                              Deaktivieren
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => aktiviereNutzer(nutzer)}
                              disabled={aktiviereNutzerId === nutzer.id}
                              aria-label={`${nutzer.email} aktivieren`}
                            >
                              {aktiviereNutzerId === nutzer.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Aktivieren
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <NeuenNutzerDialog
        offen={neuerNutzerOffen}
        onOffenChange={setNeuerNutzerOffen}
        onErfolg={() => {
          setNeuerNutzerOffen(false)
          ladeNutzer()
        }}
      />

      <PasswortZuruecksetzenDialog
        nutzer={passwortResetNutzer}
        onSchliessen={() => setPasswortResetNutzer(null)}
      />

      <NutzerDeaktivierenDialog
        nutzer={deaktivierenNutzer}
        onSchliessen={() => setDeaktivierenNutzer(null)}
        onErfolg={() => {
          setDeaktivierenNutzer(null)
          ladeNutzer()
        }}
      />
    </Card>
  )
}
