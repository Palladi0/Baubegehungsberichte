'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Loader2,
  AlertCircle,
  Save,
  FileText,
  ExternalLink,
  ChevronLeft,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import Deckblatt from '@/components/berichte/Deckblatt'
import AbschnittListe from '@/components/berichte/AbschnittListe'
import PDFExportDialog from '@/components/berichte/PDFExportDialog'
import { VorlageAuswahl } from '@/components/vorlagen/VorlageAuswahl'
import type { BerichtMitVersion, BerichtsSnapshot, AbschnittInBericht } from '@/types/berichte'

type VersionKurzinfo = { id: string; version_nr: number; erstellt_am: string }

function formatiereDatumZeit(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function BerichtEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [bericht, setBericht] = useState<BerichtMitVersion | null>(null)
  const [snapshot, setSnapshot] = useState<BerichtsSnapshot | null>(null)
  const [versionen, setVersionen] = useState<VersionKurzinfo[]>([])
  const [gewaehlteVersion, setGewaehlteVersion] = useState<number | null>(null)

  const [laedt, setLaedt] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null)
  const [gespeichertUm, setGespeichertUm] = useState<string | null>(null)

  const ladeBericht = useCallback(async () => {
    setLaedt(true)
    setLadeFehler(null)
    try {
      const [berichtAntwort, versionenAntwort] = await Promise.all([
        fetch(`/api/reports/${id}`, { cache: 'no-store' }),
        fetch(`/api/reports/${id}/versions`, { cache: 'no-store' }),
      ])

      if (!berichtAntwort.ok) {
        const body = await berichtAntwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Bericht konnte nicht geladen werden.')
      }

      const berichtDaten: BerichtMitVersion = await berichtAntwort.json()
      const versionenDaten: VersionKurzinfo[] = await versionenAntwort.json().catch(() => [])

      setBericht(berichtDaten)
      setVersionen(versionenDaten)
      setGewaehlteVersion(berichtDaten.aktuelle_version_nr)

      if (berichtDaten.aktuelle_version?.inhalt) {
        setSnapshot(berichtDaten.aktuelle_version.inhalt)
      }
    } catch (err) {
      setLadeFehler(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLaedt(false)
    }
  }, [id])

  useEffect(() => {
    ladeBericht()
  }, [ladeBericht])

  async function ladeVersion(versionNr: number) {
    try {
      const antwort = await fetch(`/api/reports/${id}/versions/${versionNr}`, {
        cache: 'no-store',
      })
      if (!antwort.ok) return
      const daten = await antwort.json()
      setSnapshot(daten.inhalt)
      setGewaehlteVersion(versionNr)
    } catch {
      /* still show current snapshot */
    }
  }

  async function handleSpeichern() {
    if (!snapshot) return
    setSpeichert(true)
    setSpeicherFehler(null)
    try {
      const antwort = await fetch(`/api/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inhalt: snapshot }),
      })
      const daten = await antwort.json()

      if (!antwort.ok) {
        setSpeicherFehler(daten.error ?? 'Speichern fehlgeschlagen.')
        return
      }

      setGespeichertUm(new Date().toLocaleTimeString('de-DE', { timeStyle: 'short' }))

      // Versionsliste neu laden
      const versionenAntwort = await fetch(`/api/reports/${id}/versions`, { cache: 'no-store' })
      const versionenDaten: VersionKurzinfo[] = await versionenAntwort.json().catch(() => [])
      setVersionen(versionenDaten)
      setGewaehlteVersion(daten.version_nr)

      if (bericht) {
        setBericht({ ...bericht, aktuelle_version_nr: daten.version_nr })
      }
    } catch {
      setSpeicherFehler('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setSpeichert(false)
    }
  }

  function updateAbschnitte(abschnitte: AbschnittInBericht[]) {
    if (!snapshot) return
    setSnapshot({ ...snapshot, abschnitte })
  }

  if (laedt) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Bericht wird geladen …
      </div>
    )
  }

  if (ladeFehler) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{ladeFehler}</span>
            <Button variant="outline" size="sm" onClick={ladeBericht}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  if (!bericht || !snapshot) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-center text-muted-foreground">Bericht nicht gefunden.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-bold sm:text-2xl">
                Baustellenbegehung – {bericht.projekt_name}
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(bericht.begehungs_datum).toLocaleDateString('de-DE', {
                dateStyle: 'long',
              })}{' '}
              · Nr. {bericht.projekt_nummer}
            </p>
          </div>

          {/* Aktionen */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Vorlagen-Auswahl */}
            <VorlageAuswahl
              berichtId={id}
              aktuelleVorlageId={bericht.vorlage_id ?? null}
            />

            {/* Vorschau öffnen */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/reports/${id}/preview`, '_blank')}
            >
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Vorschau
            </Button>

            {/* PDF-Export */}
            <PDFExportDialog
              berichtId={id}
              projektKuerzel={bericht.projekt_nummer}
              begehungsDatum={bericht.begehungs_datum}
              aktuelleVersionNr={bericht.aktuelle_version_nr}
              pdfVersionNr={bericht.pdf_versions_nr}
              fotoAnzahl={snapshot.abschnitte.reduce(
                (sum, a) => sum + a.fotos.filter((f) => f.sichtbar).length,
                0
              )}
            />

            {/* Speichern */}
            <Button onClick={handleSpeichern} disabled={speichert} size="sm">
              {speichert ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Speichert …
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-4 w-4" />
                  Speichern
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Versions-Zeile */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="outline">
            Version {bericht.aktuelle_version_nr}
          </Badge>

          {gespeichertUm && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Gespeichert um {gespeichertUm} Uhr
            </span>
          )}

          {versionen.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Version laden:</span>
              <Select
                value={String(gewaehlteVersion)}
                onValueChange={(v) => ladeVersion(parseInt(v, 10))}
              >
                <SelectTrigger className="h-7 w-36 text-xs" aria-label="Version laden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versionen.map((v) => (
                    <SelectItem key={v.id} value={String(v.version_nr)}>
                      V{v.version_nr} – {formatiereDatumZeit(v.erstellt_am)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {speicherFehler && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{speicherFehler}</AlertDescription>
          </Alert>
        )}
      </div>

      <Separator className="mb-8" />

      {/* Deckblatt */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Deckblatt (Seite 1)
        </h2>
        <Deckblatt
          deckblatt={snapshot.deckblatt}
          onChange={(deckblatt) => setSnapshot({ ...snapshot, deckblatt })}
        />
      </section>

      {/* Abschnitte */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Abschnitte ({snapshot.abschnitte.filter((a) => a.sichtbar).length} sichtbar
            {snapshot.abschnitte.length !== snapshot.abschnitte.filter((a) => a.sichtbar).length
              ? ` / ${snapshot.abschnitte.length} gesamt`
              : ''}
            )
          </h2>
        </div>

        {snapshot.abschnitte.length === 0 ? (
          <div className="rounded-md border border-dashed py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-8 w-8" />
            <p className="text-sm">Keine Abschnitte vorhanden.</p>
          </div>
        ) : (
          <AbschnittListe
            abschnitte={snapshot.abschnitte}
            onChange={updateAbschnitte}
          />
        )}
      </section>
    </main>
  )
}
