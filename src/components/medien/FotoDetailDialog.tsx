'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react'
import type { Foto, Begehung } from './types'

interface Props {
  foto: Foto | null
  begehungen: Begehung[]
  offen: boolean
  onSchliessen: () => void
  onGespeichert: (id: string, bildunterschrift: string, begehungId: string | null) => void
}

function formatiereDatum(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' })
}

const KEINE_BEGEHUNG = '__keine__'

export function FotoDetailDialog({ foto, begehungen, offen, onSchliessen, onGespeichert }: Props) {
  const [unterschrift, setUnterschrift] = useState(foto?.bildunterschrift ?? '')
  const [begehungId, setBegehungId] = useState<string>(foto?.begehung_id ?? KEINE_BEGEHUNG)
  const [laedtKI, setLaedtKI] = useState(false)
  const [kiFortschritt, setKiFortschritt] = useState(0)
  const [kiVorschlag, setKiVorschlag] = useState<string | null>(null)
  const [kiFehlermeldung, setKiFehlermeldung] = useState<string | null>(null)
  const [laedtSpeichern, setLaedtSpeichern] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  if (!foto) return null

  async function generiereKiCaption() {
    if (!foto) return
    setLaedtKI(true)
    setKiVorschlag(null)
    setKiFehlermeldung(null)
    setKiFortschritt(20)

    const interval = setInterval(() => {
      setKiFortschritt((p) => Math.min(p + 15, 85))
    }, 600)

    try {
      const res = await fetch(`/api/media/${foto.id}/caption`, { method: 'POST' })
      clearInterval(interval)
      setKiFortschritt(100)
      const json = await res.json()
      if (!res.ok) {
        setKiFehlermeldung(json.error ?? 'KI-Analyse fehlgeschlagen.')
      } else {
        setKiVorschlag(json.vorschlag)
      }
    } catch {
      clearInterval(interval)
      setKiFehlermeldung('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setLaedtKI(false)
      setTimeout(() => setKiFortschritt(0), 800)
    }
  }

  async function speichern() {
    if (!foto) return
    setLaedtSpeichern(true)
    setFehler(null)
    try {
      const res = await fetch(`/api/media/${foto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bildunterschrift: unterschrift || null,
          begehung_id: begehungId === KEINE_BEGEHUNG ? null : begehungId,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setFehler(json.error ?? 'Speichern fehlgeschlagen.')
        return
      }
      onGespeichert(foto.id, unterschrift, begehungId === KEINE_BEGEHUNG ? null : begehungId)
      onSchliessen()
    } catch {
      setFehler('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setLaedtSpeichern(false)
    }
  }

  const istGeaendert =
    unterschrift !== (foto.bildunterschrift ?? '') ||
    begehungId !== (foto.begehung_id ?? KEINE_BEGEHUNG)

  return (
    <Dialog open={offen} onOpenChange={(o) => { if (!o) onSchliessen() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{foto.original_dateiname}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Großbild */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/media/file/${foto.id}?v=display`}
            alt={foto.bildunterschrift ?? foto.original_dateiname}
            className="w-full rounded-md object-contain max-h-80 bg-muted"
          />

          {/* KI-Vorschlag Banner */}
          {kiVorschlag && (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">{kiVorschlag}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setUnterschrift(kiVorschlag); setKiVorschlag(null) }}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Übernehmen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {kiFehlermeldung && (
            <Alert variant="destructive">
              <AlertDescription>{kiFehlermeldung}</AlertDescription>
            </Alert>
          )}

          {laedtKI && kiFortschritt > 0 && (
            <Progress value={kiFortschritt} className="h-1" aria-label="KI-Analyse läuft" />
          )}

          {/* Bildunterschrift */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="unterschrift">Bildunterschrift</Label>
              <span className="text-xs text-muted-foreground">{unterschrift.length}/500</span>
            </div>
            <Textarea
              id="unterschrift"
              value={unterschrift}
              onChange={(e) => setUnterschrift(e.target.value.slice(0, 500))}
              placeholder="Beschreibung des Fotos…"
              rows={3}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={generiereKiCaption}
              disabled={laedtKI}
              aria-busy={laedtKI}
            >
              {laedtKI ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> KI analysiert…</>
              ) : (
                <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> KI-Bildunterschrift generieren</>
              )}
            </Button>
          </div>

          {/* Begehungszuordnung */}
          <div className="space-y-1.5">
            <Label htmlFor="begehung-select">Begehung (optional)</Label>
            <Select value={begehungId} onValueChange={setBegehungId}>
              <SelectTrigger id="begehung-select">
                <SelectValue placeholder="Keiner Begehung zuordnen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEINE_BEGEHUNG}>Keine Begehung</SelectItem>
                {begehungen.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {formatiereDatum(b.datum)} · {b.uhrzeit.slice(0, 5)} Uhr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fehler && (
            <Alert variant="destructive">
              <AlertDescription>{fehler}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onSchliessen} disabled={laedtSpeichern}>
            Abbrechen
          </Button>
          <Button onClick={speichern} disabled={laedtSpeichern || !istGeaendert} aria-busy={laedtSpeichern}>
            {laedtSpeichern ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Speichern…</>
            ) : (
              'Speichern'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
