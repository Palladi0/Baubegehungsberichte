'use client'

import { useState } from 'react'
import { Download, FileDown, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Phase = 'idle' | 'generating' | 'success' | 'error'

interface PDFExportDialogProps {
  berichtId: string
  projektKuerzel: string
  begehungsDatum: string
  aktuelleVersionNr: number
  pdfVersionNr?: number | null
  fotoAnzahl?: number
}

export default function PDFExportDialog({
  berichtId,
  projektKuerzel,
  begehungsDatum,
  aktuelleVersionNr,
  pdfVersionNr,
  fotoAnzahl = 0,
}: PDFExportDialogProps) {
  const [offen, setOffen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [fortschritt, setFortschritt] = useState(0)
  const [fehler, setFehler] = useState<string | null>(null)
  const [warnung, setWarnung] = useState<string | null>(null)
  const [dateiname, setDateiname] = useState<string | null>(null)
  const [exportierteFortschrittsNr, setExportierteFortschrittsNr] = useState<number | null>(null)

  const istVeraltet =
    pdfVersionNr != null && pdfVersionNr < aktuelleVersionNr

  function oeffneDialog() {
    setPhase('idle')
    setFortschritt(0)
    setFehler(null)
    setWarnung(null)
    setDateiname(null)
    setOffen(true)
  }

  async function startExport() {
    setPhase('generating')
    setFehler(null)
    setWarnung(null)
    setFortschritt(10)

    // Simulierter Fortschritt während der serverseitigen Generierung läuft
    const timer = setInterval(() => {
      setFortschritt((p) => Math.min(p + 5, 85))
    }, 1200)

    try {
      const antwort = await fetch(`/api/reports/${berichtId}/export`, {
        method: 'POST',
      })

      clearInterval(timer)

      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'PDF-Generierung fehlgeschlagen.')
      }

      const daten = await antwort.json()

      setFortschritt(100)
      setDateiname(daten.dateiname)
      setWarnung(daten.warnung ?? null)
      setExportierteFortschrittsNr(daten.version_nr)
      setPhase('success')
    } catch (err) {
      clearInterval(timer)
      setFehler(err instanceof Error ? err.message : 'Unbekannter Fehler.')
      setPhase('error')
    }
  }

  function handleDownload() {
    const link = document.createElement('a')
    link.href = `/api/reports/${berichtId}/download`
    link.download = dateiname ?? `${projektKuerzel}_Begehung_${begehungsDatum}.pdf`
    link.click()
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={oeffneDialog}>
        <FileDown className="mr-1.5 h-4 w-4" />
        PDF exportieren
        {istVeraltet && (
          <span className="ml-1.5 h-2 w-2 rounded-full bg-amber-500" title="PDF veraltet" />
        )}
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PDF exportieren</DialogTitle>
            <DialogDescription>
              {projektKuerzel} · Begehung vom{' '}
              {new Date(begehungsDatum).toLocaleDateString('de-DE', { dateStyle: 'long' })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Veraltungs-Hinweis */}
            {istVeraltet && phase === 'idle' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Das vorhandene PDF basiert auf Version {pdfVersionNr}. Die aktuelle Version ist{' '}
                  {aktuelleVersionNr}. Bitte neu generieren.
                </AlertDescription>
              </Alert>
            )}

            {/* Idle: Startbutton */}
            {phase === 'idle' && (
              <div className="flex flex-col gap-3">
                {pdfVersionNr != null && !istVeraltet && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between gap-2">
                      <span>PDF vorhanden (Version {pdfVersionNr}).</span>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="text-sm underline underline-offset-2"
                      >
                        Herunterladen
                      </button>
                    </AlertDescription>
                  </Alert>
                )}
                {fotoAnzahl > 100 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Dieser Bericht enthält {fotoAnzahl} Fotos. Die Generierung kann bis zu 2 Minuten dauern.
                    </AlertDescription>
                  </Alert>
                )}
                <Button onClick={startExport} className="w-full">
                  <FileDown className="mr-2 h-4 w-4" />
                  {pdfVersionNr != null ? 'Neu generieren' : 'PDF generieren'}
                </Button>
              </div>
            )}

            {/* Generierung läuft */}
            {phase === 'generating' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  PDF wird erstellt …
                </div>
                <Progress value={fortschritt} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Bitte warten. Dies kann bis zu 30 Sekunden dauern.
                </p>
              </div>
            )}

            {/* Erfolg */}
            {phase === 'success' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  PDF erfolgreich erstellt (Version {exportierteFortschrittsNr}).
                </div>

                {warnung && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{warnung}</AlertDescription>
                  </Alert>
                )}

                <Button onClick={handleDownload} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  {dateiname ?? 'PDF herunterladen'}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={startExport}
                >
                  Erneut generieren
                </Button>
              </div>
            )}

            {/* Fehler */}
            {phase === 'error' && (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{fehler}</AlertDescription>
                </Alert>
                <Button onClick={startExport} className="w-full">
                  Erneut versuchen
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
