'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

interface MigrationCheckResult {
  credentialsValid: boolean | null
  phoneNumberRegistered: boolean | null
  templateApproved: boolean | null
  errors: Record<string, string>
}

type CheckState = 'pending' | 'loading' | 'ok' | 'fail'

function CheckIcon({ state }: { state: CheckState }) {
  if (state === 'loading') return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
  if (state === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-600" />
  if (state === 'fail') return <XCircle className="h-4 w-4 text-destructive" />
  return <Clock className="h-4 w-4 text-muted-foreground" />
}

function boolToState(value: boolean | null, loading: boolean): CheckState {
  if (loading) return 'loading'
  if (value === null) return 'pending'
  return value ? 'ok' : 'fail'
}

export function MigrationsChecklisteCard() {
  const [checks, setChecks] = useState<MigrationCheckResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Manuelle Checkboxen — in localStorage gespeichert, damit sie den Seitenreload überleben
  const [metaVerifiziert, setMetaVerifiziert] = useState(() => {
    try { return localStorage.getItem('proj11_meta_verifiziert') === 'true' } catch { return false }
  })
  const [testlaufErfolgreich, setTestlaufErfolgreich] = useState(() => {
    try { return localStorage.getItem('proj11_testlauf_erfolgreich') === 'true' } catch { return false }
  })

  function handleMetaVerifiziert(v: boolean) {
    setMetaVerifiziert(v)
    try { localStorage.setItem('proj11_meta_verifiziert', String(v)) } catch { /* ignore */ }
  }

  function handleTestlaufErfolgreich(v: boolean) {
    setTestlaufErfolgreich(v)
    try { localStorage.setItem('proj11_testlauf_erfolgreich', String(v)) } catch { /* ignore */ }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/whatsapp/migration-checks')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as MigrationCheckResult
      setChecks(data)
      setLastChecked(new Date())
    } catch {
      setFetchError('Prüfungen konnten nicht durchgeführt werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const autoChecksOk =
    checks?.credentialsValid === true &&
    checks?.phoneNumberRegistered === true &&
    checks?.templateApproved === true

  const allOk = autoChecksOk && metaVerifiziert && testlaufErfolgreich

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Migrations-Checkliste</CardTitle>
            {allOk && (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                Bereit für Produktion
              </Badge>
            )}
          </div>
          <CardDescription>
            Automatische und manuelle Prüfungen vor dem Wechsel in den Produktions-Modus.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} aria-label="Prüfungen neu starten">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {fetchError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{fetchError}</p>
          </div>
        )}

        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Automatische Prüfungen
        </p>

        <div className="space-y-3">
          {/* Credentials */}
          <div className="flex items-start gap-3">
            <CheckIcon state={boolToState(checks?.credentialsValid ?? null, loading)} />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Produktions-Credentials gültig</p>
              <p className="text-xs text-muted-foreground">
                TWILIO_PRODUCTION_ACCOUNT_SID + AUTH_TOKEN werden gegen Twilio API validiert
              </p>
              {checks?.errors.credentials && !loading && (
                <p className="text-xs text-destructive">{checks.errors.credentials}</p>
              )}
            </div>
          </div>

          {/* Telefonnummer */}
          <div className="flex items-start gap-3">
            <CheckIcon state={boolToState(checks?.phoneNumberRegistered ?? null, loading)} />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Büronummer als WhatsApp Business Number registriert</p>
              <p className="text-xs text-muted-foreground">
                TWILIO_PRODUCTION_PHONE_NUMBER muss in den Twilio Incoming Numbers erscheinen
              </p>
              {checks?.errors.phone && !loading && (
                <p className="text-xs text-destructive">{checks.errors.phone}</p>
              )}
            </div>
          </div>

          {/* Template */}
          <div className="flex items-start gap-3">
            <CheckIcon state={boolToState(checks?.templateApproved ?? null, loading)} />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Mindestens 1 Template mit Status APPROVED</p>
              <p className="text-xs text-muted-foreground">
                Template-SIDs aus system_config werden live gegen die Twilio Content API geprüft
              </p>
              {checks?.errors.template && !loading && (
                <p className="text-xs text-destructive">{checks.errors.template}</p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Manuelle Schritte
        </p>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="meta-verifiziert"
              checked={metaVerifiziert}
              onCheckedChange={(v) => handleMetaVerifiziert(v === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="meta-verifiziert" className="text-sm font-medium cursor-pointer">
                Meta Business Account verifiziert
              </Label>
              <p className="text-xs text-muted-foreground">
                Geschäftsverifizierung im Meta Business Manager abgeschlossen
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="testlauf"
              checked={testlaufErfolgreich}
              onCheckedChange={(v) => handleTestlaufErfolgreich(v === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="testlauf" className="text-sm font-medium cursor-pointer">
                Testlauf mit Mitarbeiter-Nummer erfolgreich
              </Label>
              <p className="text-xs text-muted-foreground">
                Probenachricht wurde empfangen und Template-Antwort wurde korrekt zugestellt
              </p>
            </div>
          </div>
        </div>

        {lastChecked && (
          <p className="text-xs text-muted-foreground text-right">
            Automatische Prüfungen zuletzt: {lastChecked.toLocaleTimeString('de-DE')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
