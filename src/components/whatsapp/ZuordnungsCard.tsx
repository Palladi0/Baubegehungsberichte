'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw, Mic, Image, MessageSquare, Play } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

type UnassignedMessage = {
  id: string
  sender_phone: string
  message_type: 'text' | 'audio' | 'foto'
  text_content: string | null
  transcript: string | null
  received_at: string
  assignment_status: 'pending' | 'awaiting_clarification' | 'manual_required' | 'failed'
  clarification_attempts: number
}

type Projekt = {
  id: string
  name: string
  kuerzel: string
}

function formatiereDatumZeit(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

function TypIcon({ typ }: { typ: UnassignedMessage['message_type'] }) {
  if (typ === 'audio') return <Mic className="h-4 w-4" aria-hidden />
  if (typ === 'foto') return <Image className="h-4 w-4" aria-hidden />
  return <MessageSquare className="h-4 w-4" aria-hidden />
}

function ZuordnungsStatusBadge({ status }: { status: UnassignedMessage['assignment_status'] }) {
  const bezeichnung: Record<UnassignedMessage['assignment_status'], string> = {
    pending: 'Ausstehend',
    awaiting_clarification: 'Klärt…',
    manual_required: 'Manuell nötig',
    failed: 'Fehlgeschlagen',
  }
  const variante: Record<UnassignedMessage['assignment_status'], 'secondary' | 'outline' | 'default' | 'destructive'> = {
    pending: 'secondary',
    awaiting_clarification: 'outline',
    manual_required: 'default',
    failed: 'destructive',
  }
  return <Badge variant={variante[status]}>{bezeichnung[status]}</Badge>
}

function NachrichtZeile({
  nachricht,
  projekte,
  onAssigned,
}: {
  nachricht: UnassignedMessage
  projekte: Projekt[]
  onAssigned: (id: string) => void
}) {
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const kurzinhalt = nachricht.text_content
    ?? (nachricht.transcript ? nachricht.transcript.slice(0, 60) + (nachricht.transcript.length > 60 ? '…' : '') : null)
    ?? '—'

  const handleAssign = async () => {
    if (!selectedProjectId) return
    setIsSubmitting(true)
    try {
      const antwort = await fetch(`/api/admin/whatsapp/messages/${nachricht.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProjectId }),
      })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Zuordnung fehlgeschlagen')
      }
      toast.success('Nachricht erfolgreich zugeordnet.')
      onAssigned(nachricht.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-sm">
        {formatiereDatumZeit(nachricht.received_at)}
      </TableCell>
      <TableCell className="font-mono text-sm">{nachricht.sender_phone}</TableCell>
      <TableCell>
        <span className="flex items-center gap-1 text-sm text-muted-foreground" aria-label={nachricht.message_type}>
          <TypIcon typ={nachricht.message_type} />
          {nachricht.message_type === 'audio' ? 'Sprache' : nachricht.message_type === 'foto' ? 'Foto' : 'Text'}
        </span>
      </TableCell>
      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
        {kurzinhalt}
      </TableCell>
      <TableCell>
        <ZuordnungsStatusBadge status={nachricht.assignment_status} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="h-8 w-44 text-sm" aria-label="Projekt auswählen">
              <SelectValue placeholder="Projekt wählen…" />
            </SelectTrigger>
            <SelectContent>
              {projekte.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.kuerzel} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedProjectId || isSubmitting}
            onClick={handleAssign}
            aria-label="Zuordnung speichern"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              'Zuordnen'
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ZuordnungsCard() {
  const [nachrichten, setNachrichten] = useState<UnassignedMessage[]>([])
  const [projekte, setProjekte] = useState<Projekt[]>([])
  const [istLade, setIstLade] = useState(true)
  const [istAktualisieren, setIstAktualisieren] = useState(false)
  const [istWorkerLaeuft, setIstWorkerLaeuft] = useState(false)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)

  const ladeDaten = useCallback(async (manuell = false) => {
    if (manuell) setIstAktualisieren(true)
    else setIstLade(true)
    setLadeFehler(null)
    try {
      const [nachrichtenAntwort, projekteAntwort] = await Promise.all([
        fetch('/api/admin/whatsapp/unassigned', { cache: 'no-store' }),
        fetch('/api/projekte', { cache: 'no-store' }),
      ])
      if (!nachrichtenAntwort.ok) throw new Error('Nachrichten konnten nicht geladen werden.')
      if (!projekteAntwort.ok) throw new Error('Projekte konnten nicht geladen werden.')
      const [nachrichtenDaten, projekteDaten] = await Promise.all([
        nachrichtenAntwort.json(),
        projekteAntwort.json(),
      ])
      setNachrichten(nachrichtenDaten)
      setProjekte(projekteDaten)
      if (manuell) toast.success('Liste aktualisiert.')
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
    setIstWorkerLaeuft(true)
    try {
      const antwort = await fetch('/api/admin/whatsapp/assignment-worker', { method: 'POST' })
      if (!antwort.ok) throw new Error('Worker-Aufruf fehlgeschlagen')
      const { processed } = await antwort.json()
      toast.success(`Worker abgeschlossen: ${processed} Nachricht(en) verarbeitet.`)
      await ladeDaten(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Worker-Fehler')
    } finally {
      setIstWorkerLaeuft(false)
    }
  }

  const handleAssigned = (id: string) => {
    setNachrichten((prev) => prev.filter((n) => n.id !== id))
  }

  useEffect(() => {
    ladeDaten()
  }, [ladeDaten])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">
            Nicht zugeordnete Nachrichten
            {nachrichten.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {nachrichten.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Nachrichten, die keinem Projekt automatisch zugeordnet werden konnten.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={starteWorker}
            disabled={istWorkerLaeuft || istLade}
            aria-label="Assignment Worker manuell ausführen"
          >
            {istWorkerLaeuft ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Worker starten
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ladeDaten(true)}
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
            Lade Daten…
          </div>
        ) : nachrichten.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Alle Nachrichten sind einem Projekt zugeordnet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitstempel</TableHead>
                  <TableHead>Absender</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Inhalt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Projekt zuordnen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nachrichten.map((n) => (
                  <NachrichtZeile
                    key={n.id}
                    nachricht={n}
                    projekte={projekte}
                    onAssigned={handleAssigned}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
