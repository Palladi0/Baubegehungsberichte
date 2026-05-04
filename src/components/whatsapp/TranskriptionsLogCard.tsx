'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, AlertCircle, Play } from 'lucide-react'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type TranscriptionJob = {
  id: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  attempts: number
  duration_seconds: number | null
  cost_usd: number | null
  last_error: string | null
  created_at: string
  incoming_messages: {
    sender_phone: string
    transcript_status: string
  } | null
}

function formatiereDatumZeit(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

function formatiereSekundenAlsMinuten(sec: number | null): string {
  if (sec === null) return '—'
  const min = Math.floor(sec / 60)
  const rest = Math.round(sec % 60)
  return min > 0 ? `${min} min ${rest} s` : `${rest} s`
}

function formatiereKosten(usd: number | null): string {
  if (usd === null) return '—'
  return `$${usd.toFixed(4)}`
}

function StatusBadge({ status, fehler }: { status: TranscriptionJob['status']; fehler: string | null }) {
  const varianten: Record<TranscriptionJob['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    processing: 'outline',
    done: 'default',
    failed: 'destructive',
  }
  const bezeichnungen: Record<TranscriptionJob['status'], string> = {
    pending: 'Wartend',
    processing: 'Läuft…',
    done: 'Erledigt',
    failed: 'Fehler',
  }

  const badge = <Badge variant={varianten[status]}>{bezeichnungen[status]}</Badge>

  if (status === 'failed' && fehler) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs">{fehler}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}

export function TranskriptionsLogCard() {
  const [jobs, setJobs] = useState<TranscriptionJob[]>([])
  const [istLade, setIstLade] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [istAktualisieren, setIstAktualisieren] = useState(false)
  const [istWorkerAktiv, setIstWorkerAktiv] = useState(false)

  const ladeJobs = useCallback(async (manuell = false) => {
    if (manuell) setIstAktualisieren(true)
    else setIstLade(true)
    setLadeFehler(null)
    try {
      const antwort = await fetch('/api/admin/whatsapp/transcription-jobs', { cache: 'no-store' })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Jobs konnten nicht geladen werden.')
      }
      const daten: TranscriptionJob[] = await antwort.json()
      setJobs(daten)
      if (manuell) toast.success('Transkriptions-Log aktualisiert.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.'
      setLadeFehler(msg)
      if (manuell) toast.error(msg)
    } finally {
      setIstLade(false)
      setIstAktualisieren(false)
    }
  }, [])

  const starteWorker = async () => {
    setIstWorkerAktiv(true)
    try {
      const antwort = await fetch('/api/admin/whatsapp/transcription-worker', { method: 'POST' })
      const daten = await antwort.json()
      toast.success(`Worker abgeschlossen: ${daten.processed} transkribiert, ${daten.failed} fehlgeschlagen.`)
      await ladeJobs(false)
    } catch {
      toast.error('Worker konnte nicht gestartet werden.')
    } finally {
      setIstWorkerAktiv(false)
    }
  }

  useEffect(() => {
    ladeJobs()
  }, [ladeJobs])

  const gesamtkosten = jobs
    .filter((j) => j.status === 'done' && j.cost_usd !== null)
    .reduce((sum, j) => sum + (j.cost_usd ?? 0), 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Transkriptions-Log</CardTitle>
          <CardDescription>
            Whisper-Jobs der letzten 100 Sprachnachrichten.
            {jobs.length > 0 && (
              <span className="ml-2 text-xs">
                Gesamtkosten (angezeigt): <strong>${gesamtkosten.toFixed(4)}</strong>
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={starteWorker}
            disabled={istWorkerAktiv || istLade}
            aria-label="Worker manuell starten"
          >
            <Play className={`mr-2 h-4 w-4 ${istWorkerAktiv ? 'animate-pulse' : ''}`} />
            Worker starten
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ladeJobs(true)}
            disabled={istLade || istAktualisieren}
            aria-label="Liste aktualisieren"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${istAktualisieren ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>
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
            Lade Jobs…
          </div>
        ) : jobs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Transkriptions-Jobs vorhanden.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Absender</TableHead>
                  <TableHead>Dauer</TableHead>
                  <TableHead>Kosten</TableHead>
                  <TableHead>Versuche</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatiereDatumZeit(j.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {j.incoming_messages?.sender_phone ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatiereSekundenAlsMinuten(j.duration_seconds)}
                    </TableCell>
                    <TableCell className="text-sm">{formatiereKosten(j.cost_usd)}</TableCell>
                    <TableCell className="text-sm">{j.attempts}</TableCell>
                    <TableCell>
                      <StatusBadge status={j.status} fehler={j.last_error} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
