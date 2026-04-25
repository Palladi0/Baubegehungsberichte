'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CloudSun, Sparkles, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import { TeilnehmerListe } from './TeilnehmerListe'
import {
  WETTERBEDINGUNGEN,
  type BegehungFormData,
  type BegehungEintrag,
  type KiExtraktionErgebnis,
  type ProjektOption,
  type Teilnehmer,
  type Wetterbedingung,
} from './types'

interface BegehungsFormularProps {
  begehungId?: string
  initialDaten?: BegehungEintrag
  projekte: ProjektOption[]
}

function heuteDatum(): string {
  return new Date().toISOString().split('T')[0]
}

function jetztUhrzeit(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

const LEER: BegehungFormData = {
  projekt_id: '',
  datum: heuteDatum(),
  uhrzeit: jetztUhrzeit(),
  wetterbedingungen: '',
  temperatur: '',
  leistungsstand: '',
  vorkommnisse: '',
  massnahmen: '',
  bemerkungen: '',
  status: 'Entwurf',
  teilnehmer: [],
}

type KiBefuellt = Set<'leistungsstand' | 'vorkommnisse' | 'massnahmen' | 'bemerkungen'>

export function BegehungsFormular({ begehungId, initialDaten, projekte }: BegehungsFormularProps) {
  const router = useRouter()
  const isBearbeiten = !!begehungId

  const STORAGE_KEY = `begehung_entwurf_${begehungId ?? 'neu'}`

  function initialFormDaten(): BegehungFormData {
    if (initialDaten) {
      return {
        projekt_id: initialDaten.projekt_id,
        datum: initialDaten.datum,
        uhrzeit: initialDaten.uhrzeit.slice(0, 5),
        wetterbedingungen: (initialDaten.wetterbedingungen as Wetterbedingung) ?? '',
        temperatur: initialDaten.temperatur != null ? String(initialDaten.temperatur) : '',
        leistungsstand: initialDaten.leistungsstand ?? '',
        vorkommnisse: initialDaten.vorkommnisse ?? '',
        massnahmen: initialDaten.massnahmen ?? '',
        bemerkungen: initialDaten.bemerkungen ?? '',
        status: initialDaten.status,
        teilnehmer: initialDaten.teilnehmer.map((t) => ({ name: t.name, rolle: t.rolle })),
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const gespeichert = localStorage.getItem(STORAGE_KEY)
        if (gespeichert) return JSON.parse(gespeichert) as BegehungFormData
      } catch {
        // Ignorieren
      }
    }

    return LEER
  }

  const [formDaten, setFormDaten] = useState<BegehungFormData>(initialFormDaten)
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>(() =>
    (initialDaten?.teilnehmer ?? []).map((t) => ({ ...t, id: crypto.randomUUID() }))
  )
  const [kiBefuellt, setKiBefuellt] = useState<KiBefuellt>(new Set())
  const [freitext, setFreitext] = useState('')
  const [kiLaed, setKiLaed] = useState(false)
  const [kiProgress, setKiProgress] = useState(0)
  const [wetterLaed, setWetterLaed] = useState(false)
  const [speichernLaed, setSpeichernLaed] = useState(false)
  const [duplikatWarnung, setDuplikatWarnung] = useState(false)
  const [inBerichtWarnung, setInBerichtWarnung] = useState(false)
  const [letzteAutosave, setLetzteAutosave] = useState<Date | null>(null)
  const [hatAenderungen, setHatAenderungen] = useState(false)

  const formDatenRef = useRef(formDaten)
  formDatenRef.current = formDaten

  // Autosave alle 60 Sekunden in localStorage
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formDatenRef.current))
        setLetzteAutosave(new Date())
      } catch {
        // Ignorieren
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [STORAGE_KEY])

  // Verlassen-Schutz
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hatAenderungen) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hatAenderungen])

  // Begehung bereits in Bericht (Platzhalter, PROJ-5 setzt dieses Flag)
  useEffect(() => {
    if (initialDaten) {
      setInBerichtWarnung(false)
    }
  }, [initialDaten])

  type KiBefuelltFeld = 'leistungsstand' | 'vorkommnisse' | 'massnahmen' | 'bemerkungen'
  const KI_FELDER = new Set<string>(['leistungsstand', 'vorkommnisse', 'massnahmen', 'bemerkungen'])

  function setFeld<K extends keyof BegehungFormData>(key: K, wert: BegehungFormData[K]) {
    setFormDaten((prev) => ({ ...prev, [key]: wert }))
    setHatAenderungen(true)
    if (KI_FELDER.has(key as string)) {
      setKiBefuellt((prev) => {
        const next = new Set(prev)
        next.delete(key as KiBefuelltFeld)
        return next
      })
    }
  }

  // Wetter abrufen
  const selectedProjekt = projekte.find((p) => p.id === formDaten.projekt_id)

  async function handleWetterAbrufen() {
    if (!formDaten.projekt_id || !formDaten.datum || !formDaten.uhrzeit) return
    setWetterLaed(true)
    try {
      const params = new URLSearchParams({
        datum: formDaten.datum,
        uhrzeit: formDaten.uhrzeit,
      })
      if (selectedProjekt?.lat != null && selectedProjekt?.lon != null) {
        params.set('lat', String(selectedProjekt.lat))
        params.set('lon', String(selectedProjekt.lon))
      } else if (selectedProjekt?.adresse) {
        params.set('adresse', selectedProjekt.adresse)
      }

      const res = await fetch(`/api/begehungen/wetter?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Wetterdaten konnten nicht abgerufen werden.')
        return
      }
      const daten = await res.json()
      setFormDaten((prev) => ({
        ...prev,
        wetterbedingungen: daten.wetterbedingungen ?? prev.wetterbedingungen,
        temperatur: daten.temperatur != null ? String(daten.temperatur) : prev.temperatur,
      }))
      setHatAenderungen(true)
      toast.success('Wetterdaten erfolgreich abgerufen.')
    } catch {
      toast.error('Wetterabruf fehlgeschlagen.')
    } finally {
      setWetterLaed(false)
    }
  }

  // KI-Extraktion
  async function handleKiExtraktion() {
    if (!freitext.trim() || freitext.trim().length < 10) {
      toast.error('Bitte mindestens 10 Zeichen eingeben.')
      return
    }

    setKiLaed(true)
    setKiProgress(10)

    const progressInterval = setInterval(() => {
      setKiProgress((prev) => Math.min(prev + 8, 85))
    }, 500)

    try {
      const res = await fetch('/api/begehungen/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freitext }),
      })

      clearInterval(progressInterval)
      setKiProgress(100)

      const body = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          toast.error(body.error ?? 'KI-Limit erreicht. Bitte später erneut versuchen.')
        } else {
          toast.error(body.error ?? 'KI-Extraktion fehlgeschlagen. Bitte manuell ausfüllen.')
        }
        return
      }

      if (body.leerErgebnis) {
        toast.info('Keine Felder erkannt. Bitte Felder manuell ausfüllen.')
        return
      }

      const extraktion: KiExtraktionErgebnis = body.extraktion
      const neuBefuellt = new Set<'leistungsstand' | 'vorkommnisse' | 'massnahmen' | 'bemerkungen'>()

      setFormDaten((prev) => {
        const next = { ...prev }
        if (extraktion.leistungsstand) {
          next.leistungsstand = extraktion.leistungsstand
          neuBefuellt.add('leistungsstand')
        }
        if (extraktion.vorkommnisse) {
          next.vorkommnisse = extraktion.vorkommnisse
          neuBefuellt.add('vorkommnisse')
        }
        if (extraktion.massnahmen) {
          next.massnahmen = extraktion.massnahmen
          neuBefuellt.add('massnahmen')
        }
        if (extraktion.bemerkungen) {
          next.bemerkungen = extraktion.bemerkungen
          neuBefuellt.add('bemerkungen')
        }
        return next
      })

      if (extraktion.teilnehmer && extraktion.teilnehmer.length > 0) {
        setTeilnehmer((prev) => [
          ...prev,
          ...extraktion.teilnehmer!.map((t) => ({
            id: crypto.randomUUID(),
            name: t.name,
            rolle: t.rolle,
          })),
        ])
      }

      setKiBefuellt(neuBefuellt)
      setHatAenderungen(true)
      toast.success('KI-Extraktion erfolgreich. Bitte extrahierte Felder prüfen.')
    } catch {
      clearInterval(progressInterval)
      toast.error('KI-Extraktion fehlgeschlagen. Bitte Felder manuell ausfüllen.')
    } finally {
      setKiLaed(false)
      setTimeout(() => setKiProgress(0), 1000)
    }
  }

  // Speichern
  const handleSpeichern = useCallback(
    async (zielStatus: 'Entwurf' | 'Fertig') => {
      if (!formDaten.projekt_id) {
        toast.error('Bitte ein Projekt auswählen.')
        return
      }
      if (!formDaten.datum || !formDaten.uhrzeit) {
        toast.error('Datum und Uhrzeit sind Pflichtfelder.')
        return
      }

      setSpeichernLaed(true)
      try {
        const payload = {
          ...formDaten,
          status: zielStatus,
          temperatur: formDaten.temperatur !== '' ? parseFloat(formDaten.temperatur) : null,
          wetterbedingungen: formDaten.wetterbedingungen !== '' ? formDaten.wetterbedingungen : null,
          teilnehmer: teilnehmer
            .filter((t) => t.name.trim())
            .map(({ name, rolle }) => ({ name, rolle })),
        }

        const url = isBearbeiten ? `/api/begehungen/${begehungId}` : '/api/begehungen'
        const method = isBearbeiten ? 'PUT' : 'POST'

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const body = await res.json()

        if (!res.ok) {
          toast.error(body.error ?? 'Fehler beim Speichern.')
          return
        }

        if (body.duplikatWarnung) {
          setDuplikatWarnung(true)
          toast.warning('Es existiert bereits eine Begehung für dieses Projekt an diesem Datum.')
        }

        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          // Ignorieren
        }

        setHatAenderungen(false)
        toast.success(
          zielStatus === 'Fertig'
            ? 'Begehung als "Fertig" gespeichert.'
            : 'Entwurf gespeichert.'
        )

        router.push('/begehungen')
        router.refresh()
      } catch {
        toast.error('Netzwerkfehler beim Speichern.')
      } finally {
        setSpeichernLaed(false)
      }
    },
    [formDaten, teilnehmer, begehungId, isBearbeiten, router, STORAGE_KEY]
  )

  const wetterAbrufAktiv =
    !!formDaten.projekt_id &&
    !!formDaten.datum &&
    !!formDaten.uhrzeit &&
    !!(selectedProjekt?.adresse || (selectedProjekt?.lat && selectedProjekt?.lon))

  function autosaveText() {
    if (!letzteAutosave) return null
    const sekunden = Math.round((Date.now() - letzteAutosave.getTime()) / 1000)
    if (sekunden < 60) return `vor ${sekunden} Sek.`
    return `vor ${Math.round(sekunden / 60)} Min.`
  }

  const kiTextFeldKlasse = (feld: 'leistungsstand' | 'vorkommnisse' | 'massnahmen' | 'bemerkungen') =>
    kiBefuellt.has(feld) ? 'bg-yellow-50 border-yellow-300 focus:border-yellow-400' : ''

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSpeichern('Fertig')
      }}
      className="space-y-6"
      noValidate
    >
      {/* Warnungen */}
      {duplikatWarnung && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Es existiert bereits eine Begehung für dieses Projekt an diesem Datum.
          </AlertDescription>
        </Alert>
      )}
      {inBerichtWarnung && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Diese Begehung ist bereits in einem Bericht enthalten. Änderungen aktualisieren den Bericht.
          </AlertDescription>
        </Alert>
      )}

      {/* Abschnitt 1: Basisdaten */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basisdaten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projekt_id">
              Projekt <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formDaten.projekt_id}
              onValueChange={(v) => setFeld('projekt_id', v)}
            >
              <SelectTrigger id="projekt_id" aria-label="Projekt auswählen">
                <SelectValue placeholder="Projekt auswählen …" />
              </SelectTrigger>
              <SelectContent>
                {projekte.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-muted-foreground text-xs">#{p.kuerzel}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="datum">
                Datum <span className="text-destructive">*</span>
              </Label>
              <Input
                id="datum"
                type="date"
                value={formDaten.datum}
                onChange={(e) => setFeld('datum', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uhrzeit">
                Uhrzeit <span className="text-destructive">*</span>
              </Label>
              <Input
                id="uhrzeit"
                type="time"
                value={formDaten.uhrzeit}
                onChange={(e) => setFeld('uhrzeit', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!wetterAbrufAktiv || wetterLaed}
              onClick={handleWetterAbrufen}
              className="gap-2"
            >
              {wetterLaed ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudSun className="h-4 w-4" />
              )}
              Wetterdaten abrufen
            </Button>
            {!wetterAbrufAktiv && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Projekt mit Adresse sowie Datum und Uhrzeit erforderlich.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Abschnitt 2: Wetter & Teilnehmer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wetter & Teilnehmer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wetterbedingungen">Wetterbedingungen</Label>
              <Select
                value={formDaten.wetterbedingungen}
                onValueChange={(v) => setFeld('wetterbedingungen', v as Wetterbedingung | '')}
              >
                <SelectTrigger id="wetterbedingungen">
                  <SelectValue placeholder="Wetter auswählen …" />
                </SelectTrigger>
                <SelectContent>
                  {WETTERBEDINGUNGEN.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperatur">Temperatur (°C)</Label>
              <Input
                id="temperatur"
                type="number"
                step="0.1"
                placeholder="z. B. 18"
                value={formDaten.temperatur}
                onChange={(e) => setFeld('temperatur', e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Teilnehmer / Beteiligte</Label>
            <TeilnehmerListe
              teilnehmer={teilnehmer}
              onChange={(liste) => {
                setTeilnehmer(liste)
                setHatAenderungen(true)
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Abschnitt 3: KI-Extraktion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">KI-Extraktion (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Füge Freitext-Notizen oder einen transkribierten Sprachtext ein. Claude extrahiert
            automatisch strukturierte Felder.
          </p>
          <Textarea
            placeholder="Freitext-Notizen einfügen …"
            value={freitext}
            onChange={(e) => setFreitext(e.target.value)}
            rows={6}
            className="resize-y"
            aria-label="Freitext für KI-Extraktion"
          />
          {kiLaed && (
            <div className="space-y-1">
              <Progress value={kiProgress} className="h-1.5" />
              <p className="text-xs text-muted-foreground">KI analysiert Text …</p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={kiLaed || freitext.trim().length < 10}
            onClick={handleKiExtraktion}
            className="gap-2"
          >
            {kiLaed ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            KI-Extraktion starten
          </Button>
          {kiBefuellt.size > 0 && (
            <p className="text-xs text-yellow-700">
              Gelb markierte Felder wurden von der KI befüllt — bitte prüfen und ggf. korrigieren.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Abschnitt 4: Inhaltliche Felder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inhalt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leistungsstand">Leistungsstand</Label>
            <Textarea
              id="leistungsstand"
              placeholder="z. B. Rohbau ca. 60% fertig …"
              value={formDaten.leistungsstand}
              onChange={(e) => setFeld('leistungsstand', e.target.value)}
              rows={3}
              className={kiTextFeldKlasse('leistungsstand')}
              aria-label="Leistungsstand"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vorkommnisse">Besondere Vorkommnisse</Label>
            <Textarea
              id="vorkommnisse"
              placeholder="Mängel, Probleme, Beobachtungen …"
              value={formDaten.vorkommnisse}
              onChange={(e) => setFeld('vorkommnisse', e.target.value)}
              rows={3}
              className={kiTextFeldKlasse('vorkommnisse')}
              aria-label="Besondere Vorkommnisse"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="massnahmen">Nächste Schritte / Maßnahmen</Label>
            <Textarea
              id="massnahmen"
              placeholder="Aufgaben, Termine, Verantwortliche …"
              value={formDaten.massnahmen}
              onChange={(e) => setFeld('massnahmen', e.target.value)}
              rows={3}
              className={kiTextFeldKlasse('massnahmen')}
              aria-label="Nächste Schritte"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bemerkungen">Allgemeine Bemerkungen</Label>
            <Textarea
              id="bemerkungen"
              placeholder="Sonstige Hinweise …"
              value={formDaten.bemerkungen}
              onChange={(e) => setFeld('bemerkungen', e.target.value)}
              rows={3}
              className={kiTextFeldKlasse('bemerkungen')}
              aria-label="Allgemeine Bemerkungen"
            />
          </div>
        </CardContent>
      </Card>

      {/* Abschnitt 5: Aktionen */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {autosaveText()
            ? `Lokal gespeichert: ${autosaveText()}`
            : 'Entwurf wird automatisch alle 60 Sek. lokal gesichert.'}
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={speichernLaed}
            onClick={() => handleSpeichern('Entwurf')}
          >
            {speichernLaed && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Als Entwurf speichern
          </Button>
          <Button type="submit" disabled={speichernLaed}>
            {speichernLaed && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Als Fertig speichern
          </Button>
        </div>
      </div>
    </form>
  )
}
