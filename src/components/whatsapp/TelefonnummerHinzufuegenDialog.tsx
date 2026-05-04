'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PhoneRegistration } from './WhatsAppNummernCard'

type NutzerOption = {
  id: string
  email: string
}

type TelefonnummerHinzufuegenDialogProps = {
  offen: boolean
  onSchliessen: () => void
  onHinzugefuegt: (eintrag: PhoneRegistration) => void
}

export function TelefonnummerHinzufuegenDialog({
  offen,
  onSchliessen,
  onHinzugefuegt,
}: TelefonnummerHinzufuegenDialogProps) {
  const [nutzerListe, setNutzerListe] = useState<NutzerOption[]>([])
  const [ladeNutzer, setLadeNutzer] = useState(false)

  const [userId, setUserId] = useState('')
  const [rufnummer, setRufnummer] = useState('')
  const [bezeichnung, setBezeichnung] = useState('')
  const [istSpeichern, setIstSpeichern] = useState(false)
  const [fehler, setFehler] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!offen) return
    setLadeNutzer(true)
    fetch('/api/admin/benutzer', { cache: 'no-store' })
      .then((r) => r.json())
      .then((daten: NutzerOption[]) => setNutzerListe(daten))
      .catch(() => toast.error('Nutzerliste konnte nicht geladen werden.'))
      .finally(() => setLadeNutzer(false))
  }, [offen])

  function zuruecksetzen() {
    setUserId('')
    setRufnummer('')
    setBezeichnung('')
    setFehler({})
  }

  function handleSchliessen() {
    zuruecksetzen()
    onSchliessen()
  }

  async function handleSpeichern() {
    const neueFehler: Record<string, string> = {}
    if (!userId) neueFehler.userId = 'Bitte einen Mitarbeiter auswählen.'
    if (!rufnummer) {
      neueFehler.rufnummer = 'Telefonnummer ist erforderlich.'
    } else if (!/^\+[1-9]\d{7,14}$/.test(rufnummer)) {
      neueFehler.rufnummer = 'Format: +4917612345678 (E.164)'
    }
    if (Object.keys(neueFehler).length > 0) {
      setFehler(neueFehler)
      return
    }

    setIstSpeichern(true)
    setFehler({})
    try {
      const antwort = await fetch('/api/admin/whatsapp/phone-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          phone_number: rufnummer,
          label: bezeichnung || undefined,
        }),
      })

      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        if (antwort.status === 409) {
          setFehler({ rufnummer: 'Diese Telefonnummer ist bereits registriert.' })
          return
        }
        throw new Error(body.error ?? 'Speichern fehlgeschlagen.')
      }

      const neuerEintrag: PhoneRegistration = await antwort.json()
      toast.success('Telefonnummer wurde hinzugefügt.')
      onHinzugefuegt(neuerEintrag)
      handleSchliessen()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unbekannter Fehler.')
    } finally {
      setIstSpeichern(false)
    }
  }

  return (
    <Dialog open={offen} onOpenChange={(v) => !v && handleSchliessen()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Telefonnummer hinzufügen</DialogTitle>
          <DialogDescription>
            Registriere eine WhatsApp-Nummer für einen Mitarbeiter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="mitarbeiter">Mitarbeiter</Label>
            {ladeNutzer ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lade Nutzerliste…
              </div>
            ) : (
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="mitarbeiter" aria-label="Mitarbeiter auswählen">
                  <SelectValue placeholder="Mitarbeiter auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  {nutzerListe.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {fehler.userId && (
              <p className="text-xs text-destructive">{fehler.userId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rufnummer">Telefonnummer (E.164)</Label>
            <Input
              id="rufnummer"
              placeholder="+4917612345678"
              value={rufnummer}
              onChange={(e) => setRufnummer(e.target.value)}
              aria-describedby={fehler.rufnummer ? 'rufnummer-fehler' : undefined}
            />
            {fehler.rufnummer && (
              <p id="rufnummer-fehler" className="text-xs text-destructive">
                {fehler.rufnummer}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bezeichnung">
              Bezeichnung <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="bezeichnung"
              placeholder="z. B. Privat, Arbeitshandy"
              value={bezeichnung}
              onChange={(e) => setBezeichnung(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleSchliessen} disabled={istSpeichern}>
            Abbrechen
          </Button>
          <Button onClick={handleSpeichern} disabled={istSpeichern || ladeNutzer}>
            {istSpeichern && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
