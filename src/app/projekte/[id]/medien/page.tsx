'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ImageIcon, AlertCircle, Loader2, Upload, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { FotoKachel } from '@/components/medien/FotoKachel'
import { FotoDetailDialog } from '@/components/medien/FotoDetailDialog'
import { LoeschConfirmDialog } from '@/components/medien/LoeschConfirmDialog'
import { UploadDropzone } from '@/components/medien/UploadDropzone'
import type { Foto, Begehung } from '@/components/medien/types'

type Sortierung = 'upload' | 'begehung'

type CurrentUser = { id: string; role: string }

async function ladeAktuellenNutzer(): Promise<CurrentUser | null> {
  try {
    const res = await fetch('/api/benutzer/me', { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function ladeBegehungen(projektId: string): Promise<Begehung[]> {
  try {
    const res = await fetch(`/api/begehungen?projektId=${projektId}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return (data as { id: string; datum: string; uhrzeit: string }[]).map((b) => ({
      id: b.id,
      datum: b.datum,
      uhrzeit: b.uhrzeit,
    }))
  } catch {
    return []
  }
}

export default function MedienSeite() {
  const params = useParams<{ id: string }>()
  const projektId = params.id

  const [fotos, setFotos] = useState<Foto[]>([])
  const [begehungen, setBegehungen] = useState<Begehung[]>([])
  const [aktuellerNutzer, setAktuellerNutzer] = useState<CurrentUser | null>(null)
  const [sortierung, setSortierung] = useState<Sortierung>('upload')
  const [istLade, setIstLade] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)

  const [detailFoto, setDetailFoto] = useState<Foto | null>(null)
  const [loeschFoto, setLoeschFoto] = useState<Foto | null>(null)
  const [laedtLoeschen, setLaedtLoeschen] = useState(false)
  const [uploadOffen, setUploadOffen] = useState(false)

  const ladeFotos = useCallback(async () => {
    setIstLade(true)
    setLadeFehler(null)
    try {
      const res = await fetch(`/api/media?projektId=${projektId}&sort=${sortierung}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Fotos konnten nicht geladen werden.')
      }
      setFotos(await res.json())
    } catch (e) {
      setLadeFehler(e instanceof Error ? e.message : 'Fotos konnten nicht geladen werden.')
    } finally {
      setIstLade(false)
    }
  }, [projektId, sortierung])

  useEffect(() => {
    ladeFotos()
  }, [ladeFotos])

  useEffect(() => {
    ladeAktuellenNutzer().then(setAktuellerNutzer)
    ladeBegehungen(projektId).then(setBegehungen)
  }, [projektId])

  function onGespeichert(id: string, bildunterschrift: string, begehungId: string | null) {
    setFotos((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              bildunterschrift: bildunterschrift || null,
              begehung_id: begehungId,
              begehung: begehungId
                ? (begehungen.find((b) => b.id === begehungId) ?? f.begehung)
                : null,
            }
          : f
      )
    )
  }

  async function loescheBestaetige() {
    if (!loeschFoto) return
    setLaedtLoeschen(true)
    try {
      const res = await fetch(`/api/media/${loeschFoto.id}`, { method: 'DELETE' })
      if (res.ok) {
        setFotos((prev) => prev.filter((f) => f.id !== loeschFoto.id))
        setLoeschFoto(null)
      }
    } finally {
      setLaedtLoeschen(false)
    }
  }

  function kannNutzerLoeschen(foto: Foto): boolean {
    if (!aktuellerNutzer) return false
    return aktuellerNutzer.role === 'admin' || foto.uploader_id === aktuellerNutzer.id
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Medien</h1>
          <p className="text-sm text-muted-foreground">
            {fotos.length > 0
              ? `${fotos.length} Foto${fotos.length !== 1 ? 's' : ''}`
              : 'Fotos für dieses Projekt'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={sortierung}
            onValueChange={(v) => setSortierung(v as Sortierung)}
            aria-label="Fotos sortieren"
          >
            <SelectTrigger className="w-44">
              <SlidersHorizontal className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upload">Nach Upload-Datum</SelectItem>
              <SelectItem value="begehung">Nach Begehungsdatum</SelectItem>
            </SelectContent>
          </Select>

          <Sheet open={uploadOffen} onOpenChange={setUploadOffen}>
            <SheetTrigger asChild>
              <Button>
                <Upload className="mr-1.5 h-4 w-4" />
                Fotos hochladen
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Fotos hochladen</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <UploadDropzone
                  projektId={projektId}
                  onHochgeladenFertig={() => {
                    setUploadOffen(false)
                    ladeFotos()
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Galerie</CardTitle>
          <CardDescription>Alle Fotos dieses Projekts in der Übersicht.</CardDescription>
        </CardHeader>
        <CardContent>
          {istLade && (
            <div
              className="flex items-center justify-center py-20 text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Fotos werden geladen …
            </div>
          )}

          {!istLade && ladeFehler && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{ladeFehler}</span>
                <Button variant="outline" size="sm" onClick={ladeFotos}>
                  Erneut versuchen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!istLade && !ladeFehler && fotos.length === 0 && (
            <div className="rounded-md border border-dashed py-16 text-center">
              <ImageIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Noch keine Fotos hochgeladen.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setUploadOffen(true)}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Erstes Foto hochladen
              </Button>
            </div>
          )}

          {!istLade && !ladeFehler && fotos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {fotos.map((foto) => (
                <FotoKachel
                  key={foto.id}
                  foto={foto}
                  kannLoeschen={kannNutzerLoeschen(foto)}
                  onBearbeiten={setDetailFoto}
                  onLoeschen={setLoeschFoto}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FotoDetailDialog
        key={detailFoto?.id ?? 'none'}
        foto={detailFoto}
        begehungen={begehungen}
        offen={!!detailFoto}
        onSchliessen={() => setDetailFoto(null)}
        onGespeichert={onGespeichert}
      />

      <LoeschConfirmDialog
        offen={!!loeschFoto}
        laedtLoeschen={laedtLoeschen}
        onAbbrechen={() => setLoeschFoto(null)}
        onBestaetigen={loescheBestaetige}
      />
    </main>
  )
}
