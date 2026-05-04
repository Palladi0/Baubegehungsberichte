'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TwilioTemplate {
  sid: string
  friendlyName: string
  variables: Record<string, string>
  whatsappApprovalStatus: string
  category: string
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    APPROVED: 'default',
    PENDING: 'secondary',
    REJECTED: 'destructive',
  }
  const labels: Record<string, string> = {
    APPROVED: 'Genehmigt',
    PENDING: 'Ausstehend',
    REJECTED: 'Abgelehnt',
    UNKNOWN: 'Unbekannt',
  }
  return (
    <Badge variant={variants[status] ?? 'outline'}>
      {labels[status] ?? status}
    </Badge>
  )
}

export function TemplateStatusCard() {
  const [templates, setTemplates] = useState<TwilioTemplate[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/whatsapp/templates')
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as TwilioTemplate[]
      setTemplates(data)
      setLastChecked(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Templates konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Nachrichten-Templates</CardTitle>
          <CardDescription>
            Live-Status der bei Meta registrierten WhatsApp-Templates (via Twilio Content API).
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} aria-label="Neu laden">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent>
        {error && (
          <p className="text-sm text-destructive mb-4" role="alert">{error}</p>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : templates && templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Keine Templates gefunden. Registriere Templates in der Twilio Console.
          </p>
        ) : templates ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>SID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.sid}>
                    <TableCell className="font-medium">{t.friendlyName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.category || '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.sid}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.whatsappApprovalStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {lastChecked && (
              <p className="mt-3 text-xs text-muted-foreground text-right">
                Zuletzt geprüft: {lastChecked.toLocaleTimeString('de-DE')}
              </p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
