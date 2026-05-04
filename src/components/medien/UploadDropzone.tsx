'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_SIZE = 25 * 1024 * 1024
const MAX_FILES = 20

type DateiStatus = {
  name: string
  status: 'wartend' | 'hochladen' | 'fertig' | 'fehler'
  fehler?: string
}

interface Props {
  projektId: string
  begehungId?: string
  onHochgeladenFertig: () => void
}

export function UploadDropzone({ projektId, begehungId, onHochgeladenFertig }: Props) {
  const [dateien, setDateien] = useState<DateiStatus[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [ladetHoch, setLadetHoch] = useState(false)
  const [gesamtFortschritt, setGesamtFortschritt] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // Speichert die echten File-Objekte — gemeinsame Quelle für Drag-and-Drop und Input
  const dateiObjekteRef = useRef<File[]>([])

  function validiereUndSetze(files: FileList | File[]) {
    const liste = Array.from(files).slice(0, MAX_FILES)
    dateiObjekteRef.current = liste
    const statuses: DateiStatus[] = liste.map((f) => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        return { name: f.name, status: 'fehler', fehler: 'Nur JPEG, PNG, HEIC und WebP werden unterstützt.' }
      }
      if (f.size > MAX_SIZE) {
        return { name: f.name, status: 'fehler', fehler: 'Diese Datei überschreitet die maximale Dateigröße von 25 MB.' }
      }
      return { name: f.name, status: 'wartend' }
    })
    setDateien(statuses)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    validiereUndSetze(e.dataTransfer.files)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function starteUpload() {
    const gueltige = dateiObjekteRef.current.filter(
      (f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE
    )
    if (!gueltige.length) return

    setLadetHoch(true)
    setGesamtFortschritt(10)

    const formData = new FormData()
    formData.append('projekt_id', projektId)
    if (begehungId) formData.append('begehung_id', begehungId)
    gueltige.forEach((f) => formData.append('files', f))

    setDateien(gueltige.map((f) => ({ name: f.name, status: 'hochladen' })))
    setGesamtFortschritt(40)

    try {
      const antwort = await fetch('/api/media/upload', { method: 'POST', body: formData })
      setGesamtFortschritt(90)
      const json = await antwort.json()

      setDateien(
        gueltige.map((f) => {
          const fehler = json.fehler?.find((fe: { name: string; error?: string }) => fe.name === f.name)
          if (fehler) return { name: f.name, status: 'fehler', fehler: fehler.error }
          return { name: f.name, status: 'fertig' }
        })
      )
      setGesamtFortschritt(100)
      if (json.hochgeladen?.length) {
        setTimeout(onHochgeladenFertig, 800)
      }
    } catch {
      setDateien(gueltige.map((f) => ({ name: f.name, status: 'fehler', fehler: 'Netzwerkfehler.' })))
    } finally {
      setLadetHoch(false)
    }
  }

  function loescheAuswahl() {
    dateiObjekteRef.current = []
    setDateien([])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        role="button"
        aria-label="Dateien hochladen – Drag & Drop oder klicken"
      >
        <UploadCloud className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Fotos hier ablegen oder klicken</p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPEG, PNG, HEIC, WebP · max. 25 MB pro Datei · bis zu 20 Dateien
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => e.target.files && validiereUndSetze(e.target.files)}
          aria-hidden="true"
        />
      </div>

      {dateien.length > 0 && (
        <div className="space-y-1.5">
          {dateien.map((d, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {d.status === 'fertig' && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
              {d.status === 'fehler' && <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
              {d.status === 'hochladen' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
              {d.status === 'wartend' && <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />}
              <span className="flex-1 truncate">{d.name}</span>
              {d.fehler && <span className="text-xs text-destructive">{d.fehler}</span>}
            </div>
          ))}
        </div>
      )}

      {ladetHoch && (
        <Progress value={gesamtFortschritt} className="h-1.5" aria-label="Upload-Fortschritt" />
      )}

      {dateien.some((d) => d.status === 'fehler') && !ladetHoch && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Einige Dateien konnten nicht hochgeladen werden. Überprüfe Format und Größe.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        {dateien.length > 0 && !ladetHoch && (
          <Button variant="ghost" size="sm" onClick={loescheAuswahl}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Auswahl löschen
          </Button>
        )}
        <Button
          size="sm"
          onClick={starteUpload}
          disabled={ladetHoch || !dateien.some((d) => d.status === 'wartend')}
          aria-busy={ladetHoch}
        >
          {ladetHoch ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Wird hochgeladen…</>
          ) : (
            <><UploadCloud className="mr-1.5 h-3.5 w-3.5" /> Hochladen</>
          )}
        </Button>
      </div>
    </div>
  )
}
