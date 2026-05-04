'use client'

import { useCallback, useEffect, Fragment, useState } from 'react'
import { Loader2, RefreshCw, AlertCircle, Mic, Image, MessageSquare, ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'

type IncomingMessage = {
  id: string
  twilio_message_sid: string
  sender_phone: string
  user_id: string | null
  message_type: 'text' | 'audio' | 'foto'
  text_content: string | null
  local_file_path: string | null
  transcript: string | null
  transcript_status: 'pending' | 'processing' | 'done' | 'failed' | null
  status: 'received' | 'downloading' | 'stored' | 'failed'
  received_at: string
  processed_at: string | null
  error_message: string | null
}

function formatiereDatumZeit(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

function TypIcon({ typ }: { typ: IncomingMessage['message_type'] }) {
  if (typ === 'audio') return <Mic className="h-4 w-4" aria-hidden />
  if (typ === 'foto') return <Image className="h-4 w-4" aria-hidden />
  return <MessageSquare className="h-4 w-4" aria-hidden />
}

function StatusBadge({ status, fehler }: { status: IncomingMessage['status']; fehler: string | null }) {
  const varianten: Record<IncomingMessage['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    received: 'secondary',
    downloading: 'outline',
    stored: 'default',
    failed: 'destructive',
  }
  const bezeichnungen: Record<IncomingMessage['status'], string> = {
    received: 'Empfangen',
    downloading: 'Lädt…',
    stored: 'Gespeichert',
    failed: 'Fehler',
  }

  const badge = (
    <Badge variant={varianten[status]}>{bezeichnungen[status]}</Badge>
  )

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

function TranskriptStatusBadge({ status }: { status: IncomingMessage['transcript_status'] }) {
  if (!status || status === 'pending') return <Badge variant="secondary">Wartend</Badge>
  if (status === 'processing') return <Badge variant="outline">Transkribiert…</Badge>
  if (status === 'done') return <Badge variant="default">Transkribiert</Badge>
  return <Badge variant="destructive">Fehler</Badge>
}

function TranskriptZeile({ nachricht }: { nachricht: IncomingMessage }) {
  const [bearbeitungsModus, setBearbeitungsModus] = useState(false)
  const [text, setText] = useState(nachricht.transcript ?? '')
  const [isSpeichern, setIsSpeichern] = useState(false)

  const speichern = async () => {
    setIsSpeichern(true)
    try {
      const antwort = await fetch('/api/admin/whatsapp/transcription-jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incoming_message_id: nachricht.id, transcript: text }),
      })
      if (!antwort.ok) throw new Error('Speichern fehlgeschlagen')
      toast.success('Transkript gespeichert.')
      setBearbeitungsModus(false)
    } catch {
      toast.error('Transkript konnte nicht gespeichert werden.')
    } finally {
      setIsSpeichern(false)
    }
  }

  const abbrechen = () => {
    setText(nachricht.transcript ?? '')
    setBearbeitungsModus(false)
  }

  return (
    <TableRow>
      <TableCell colSpan={5} className="bg-muted/30 py-3 px-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Transkript</span>
            <div className="flex items-center gap-1">
              <TranskriptStatusBadge status={nachricht.transcript_status} />
              {nachricht.transcript_status === 'done' && !bearbeitungsModus && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBearbeitungsModus(true)}
                  aria-label="Transkript bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {bearbeitungsModus ? (
            <div className="space-y-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[80px] text-sm"
                aria-label="Transkript bearbeiten"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={speichern} disabled={isSpeichern}>
                  {isSpeichern ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                  Speichern
                </Button>
                <Button size="sm" variant="outline" onClick={abbrechen} disabled={isSpeichern}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {nachricht.transcript ?? (
                <span className="italic text-muted-foreground">
                  {nachricht.transcript_status === 'pending' || nachricht.transcript_status === 'processing'
                    ? 'Transkription läuft…'
                    : nachricht.transcript_status === 'failed'
                      ? 'Transkription fehlgeschlagen.'
                      : 'Kein Transkript vorhanden.'}
                </span>
              )}
            </p>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function WhatsAppNachrichtenCard() {
  const [nachrichten, setNachrichten] = useState<IncomingMessage[]>([])
  const [istLade, setIstLade] = useState(true)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [istAktualisieren, setIstAktualisieren] = useState(false)
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(new Set())

  const toggleAufgeklappt = (id: string) => {
    setAufgeklappt((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const ladeNachrichten = useCallback(async (manuell = false) => {
    if (manuell) setIstAktualisieren(true)
    else setIstLade(true)
    setLadeFehler(null)
    try {
      const antwort = await fetch('/api/admin/whatsapp/messages', { cache: 'no-store' })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Nachrichten konnten nicht geladen werden.')
      }
      const daten: IncomingMessage[] = await antwort.json()
      setNachrichten(daten)
      if (manuell) toast.success('Nachrichtenliste aktualisiert.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.'
      setLadeFehler(msg)
      if (manuell) toast.error(msg)
    } finally {
      setIstLade(false)
      setIstAktualisieren(false)
    }
  }, [])

  useEffect(() => {
    ladeNachrichten()
  }, [ladeNachrichten])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Nachrichten-Log</CardTitle>
          <CardDescription>
            Die letzten 100 eingegangenen WhatsApp-Nachrichten.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => ladeNachrichten(true)}
          disabled={istLade || istAktualisieren}
          aria-label="Liste aktualisieren"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${istAktualisieren ? 'animate-spin' : ''}`}
          />
          Aktualisieren
        </Button>
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
            Lade Nachrichten…
          </div>
        ) : nachrichten.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Nachrichten eingegangen.
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {nachrichten.map((n) => (
                  <Fragment key={n.id}>
                    <TableRow
                      className={n.message_type === 'audio' ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={n.message_type === 'audio' ? () => toggleAufgeklappt(n.id) : undefined}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        <span className="flex items-center gap-1">
                          {n.message_type === 'audio' && (
                            aufgeklappt.has(n.id)
                              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {formatiereDatumZeit(n.received_at)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{n.sender_phone}</TableCell>
                      <TableCell>
                        <span
                          className="flex items-center gap-1 text-sm text-muted-foreground"
                          aria-label={n.message_type}
                        >
                          <TypIcon typ={n.message_type} />
                          {n.message_type === 'audio'
                            ? 'Sprache'
                            : n.message_type === 'foto'
                              ? 'Foto'
                              : 'Text'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {n.text_content ?? (
                          <span className="text-muted-foreground italic">
                            {n.message_type === 'audio' && n.transcript
                              ? n.transcript.slice(0, 60) + (n.transcript.length > 60 ? '…' : '')
                              : n.local_file_path
                                ? n.local_file_path.split('/').pop()
                                : '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={n.status} fehler={n.error_message} />
                      </TableCell>
                    </TableRow>
                    {n.message_type === 'audio' && aufgeklappt.has(n.id) && (
                      <TranskriptZeile key={`${n.id}-${n.transcript ?? ''}`} nachricht={n} />
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
