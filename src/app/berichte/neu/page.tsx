'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, FileText, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Projekt = { id: string; name: string; nummer: string; kuerzel: string }

export default function BerichtNeuPage() {
  const router = useRouter()
  const [projekte, setProjekte] = useState<Projekt[]>([])
  const [ladeProjekte, setLadeProjekte] = useState(true)
  const [projektId, setProjektId] = useState('')
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10))
  const [generiere, setGeneriere] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [warnung, setWarnung] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projekte', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: Projekt[]) => setProjekte(data))
      .catch(() => {})
      .finally(() => setLadeProjekte(false))
  }, [])

  async function handleGenerieren() {
    setFehler(null)
    setWarnung(null)
    setGeneriere(true)
    try {
      const antwort = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projekt_id: projektId, datum }),
      })
      const daten = await antwort.json()

      if (!antwort.ok) {
        setFehler(daten.error ?? 'Bericht konnte nicht generiert werden.')
        return
      }

      if (daten.warnung) {
        setWarnung(daten.warnung)
        setTimeout(() => router.push(`/berichte/${daten.id}`), 2500)
      } else {
        router.push(`/berichte/${daten.id}`)
      }
    } catch {
      setFehler('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setGeneriere(false)
    }
  }

  const kannGenerieren = projektId && datum && !generiere

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <FileText className="h-6 w-6" />
          Neuen Bericht erstellen
        </h1>
        <p className="text-sm text-muted-foreground">
          Wähle ein Projekt und das Begehungsdatum. Alle abgeschlossenen Begehungen
          dieses Tages werden zusammengefasst.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bericht-Generator</CardTitle>
          <CardDescription>
            Es werden nur Begehungen mit Status „Fertig" berücksichtigt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Projekt */}
          <div className="space-y-1.5">
            <Label htmlFor="projekt-select">Projekt</Label>
            {ladeProjekte ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Projekte werden geladen …
              </div>
            ) : (
              <Select value={projektId} onValueChange={setProjektId}>
                <SelectTrigger id="projekt-select" aria-label="Projekt auswählen">
                  <SelectValue placeholder="Projekt auswählen …" />
                </SelectTrigger>
                <SelectContent>
                  {projekte.length === 0 && (
                    <SelectItem value="__leer__" disabled>
                      Keine Projekte vorhanden
                    </SelectItem>
                  )}
                  {projekte.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.kuerzel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Datum */}
          <div className="space-y-1.5">
            <Label htmlFor="datum-input">Begehungsdatum</Label>
            <Input
              id="datum-input"
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              aria-label="Begehungsdatum auswählen"
            />
          </div>

          {/* Fehler */}
          {fehler && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{fehler}</AlertDescription>
            </Alert>
          )}

          {/* Hinweis (Warnung, kein Fehler) */}
          {warnung && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{warnung} Weiterleitung …</AlertDescription>
            </Alert>
          )}

          {/* Aktion */}
          <Button
            className="w-full"
            onClick={handleGenerieren}
            disabled={!kannGenerieren}
          >
            {generiere ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bericht wird generiert …
              </>
            ) : (
              'Bericht generieren'
            )}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
