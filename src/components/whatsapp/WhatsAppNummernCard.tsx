'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TelefonnummerHinzufuegenDialog } from './TelefonnummerHinzufuegenDialog'

export type PhoneRegistration = {
  id: string
  user_id: string
  phone_number: string
  label: string | null
  is_active: boolean
  created_at: string
}

function formatiereDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' })
  } catch {
    return '—'
  }
}

export function WhatsAppNummernCard() {
  const [eintraege, setEintraege] = useState<PhoneRegistration[]>([])
  const [istLade, setIstLade] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [hinzufuegenOffen, setHinzufuegenOffen] = useState(false)
  const [loeschenId, setLoeschenId] = useState<string | null>(null)
  const [istLoeschen, setIstLoeschen] = useState(false)

  const ladeEintraege = useCallback(async () => {
    setIstLade(true)
    setLadeFehler(null)
    try {
      const antwort = await fetch('/api/admin/whatsapp/phone-registrations', {
        cache: 'no-store',
      })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Liste konnte nicht geladen werden.')
      }
      const daten: PhoneRegistration[] = await antwort.json()
      setEintraege(daten)
    } catch (err) {
      setLadeFehler(err instanceof Error ? err.message : 'Unbekannter Fehler.')
    } finally {
      setIstLade(false)
    }
  }, [])

  useEffect(() => {
    ladeEintraege()
  }, [ladeEintraege])

  async function handleLoeschen() {
    if (!loeschenId) return
    setIstLoeschen(true)
    try {
      const antwort = await fetch(
        `/api/admin/whatsapp/phone-registrations/${loeschenId}`,
        { method: 'DELETE' }
      )
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Löschen fehlgeschlagen.')
      }
      setEintraege((prev) => prev.filter((e) => e.id !== loeschenId))
      toast.success('Telefonnummer wurde entfernt.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unbekannter Fehler.')
    } finally {
      setIstLoeschen(false)
      setLoeschenId(null)
    }
  }

  const loeschenEintrag = eintraege.find((e) => e.id === loeschenId)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Registrierte Telefonnummern</CardTitle>
            <CardDescription>
              Nur Nachrichten von diesen Nummern werden verarbeitet.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setHinzufuegenOffen(true)}
            disabled={istLade}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nummer hinzufügen
          </Button>
        </CardHeader>
        <CardContent>
          {ladeFehler && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{ladeFehler}</AlertDescription>
            </Alert>
          )}

          {istLade ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Lade Einträge…
            </div>
          ) : eintraege.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Telefonnummern registriert.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Telefonnummer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registriert am</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eintraege.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.label ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{e.phone_number}</TableCell>
                      <TableCell>
                        <Badge variant={e.is_active ? 'default' : 'secondary'}>
                          {e.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatiereDatum(e.created_at)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLoeschenId(e.id)}
                          aria-label={`Nummer ${e.phone_number} entfernen`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TelefonnummerHinzufuegenDialog
        offen={hinzufuegenOffen}
        onSchliessen={() => setHinzufuegenOffen(false)}
        onHinzugefuegt={(neuer) => setEintraege((prev) => [neuer, ...prev])}
      />

      <AlertDialog
        open={loeschenId !== null}
        onOpenChange={(v) => !v && setLoeschenId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Telefonnummer entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {loeschenEintrag && (
                <>
                  <span className="font-mono">{loeschenEintrag.phone_number}</span>
                  {loeschenEintrag.label && ` (${loeschenEintrag.label})`} wird aus dem
                  System entfernt. Eingehende Nachrichten von dieser Nummer werden nicht
                  mehr zugeordnet.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={istLoeschen}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLoeschen}
              disabled={istLoeschen}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {istLoeschen && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
