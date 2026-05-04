'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type WhatsAppConfig = {
  whatsapp_mode: 'sandbox' | 'production'
  whatsapp_active_number: string
  whatsapp_template_sid_bestaetigung: string
  whatsapp_template_sid_unbekannt: string
}

export function BetriebsmodusCard() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [produktionsDialogOffen, setProduktionsDialogOffen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/whatsapp/config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as WhatsAppConfig
      setConfig(data)
    } catch {
      setError('Konfiguration konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(patch: Partial<WhatsAppConfig>) {
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch('/api/admin/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConfig((prev) => prev ? { ...prev, ...patch } : prev)
      setSuccessMsg('Gespeichert.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch {
      setError('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const isProduction = config?.whatsapp_mode === 'production'

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Betriebsmodus</CardTitle>
          <CardDescription>
            Steuert, ob Nachrichten über die Twilio Sandbox oder die verifizierte Büronummer gesendet werden.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} aria-label="Neu laden">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
        {successMsg && (
          <p className="text-sm text-green-600" role="status">{successMsg}</p>
        )}

        {loading ? (
          <div className="space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : config ? (
          <>
            {/* Modus-Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">
                  {isProduction ? 'Produktions-Modus' : 'Sandbox-Modus'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isProduction
                    ? 'Alle Mitarbeiter erreichbar — Meta-Templates aktiv'
                    : 'Nur registrierte Testnummern — Freitext-Antworten'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={isProduction ? 'default' : 'secondary'}>
                  {isProduction ? 'Produktion' : 'Sandbox'}
                </Badge>
                <Switch
                  checked={isProduction}
                  disabled={saving}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setProduktionsDialogOffen(true)
                    } else {
                      handleSave({ whatsapp_mode: 'sandbox' })
                    }
                  }}
                  aria-label="Betriebsmodus umschalten"
                />
              </div>
            </div>

            {/* Aktive Nummer */}
            <div className="space-y-2">
              <Label htmlFor="active-number">Aktive WhatsApp-Nummer (E.164)</Label>
              <div className="flex gap-2">
                <Input
                  id="active-number"
                  value={config.whatsapp_active_number}
                  onChange={(e) =>
                    setConfig((prev) => prev ? { ...prev, whatsapp_active_number: e.target.value } : prev)
                  }
                  placeholder="+4989123456"
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => handleSave({ whatsapp_active_number: config.whatsapp_active_number })}
                >
                  {saving ? 'Speichert…' : 'Speichern'}
                </Button>
              </div>
            </div>

            {/* Template-SIDs */}
            <div className="space-y-4">
              <p className="text-sm font-medium">Template-SIDs</p>
              <div className="space-y-2">
                <Label htmlFor="sid-bestaetigung">Eingangsbestätigung</Label>
                <div className="flex gap-2">
                  <Input
                    id="sid-bestaetigung"
                    value={config.whatsapp_template_sid_bestaetigung}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev ? { ...prev, whatsapp_template_sid_bestaetigung: e.target.value } : prev
                      )
                    }
                    placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      handleSave({
                        whatsapp_template_sid_bestaetigung: config.whatsapp_template_sid_bestaetigung,
                      })
                    }
                  >
                    {saving ? 'Speichert…' : 'Speichern'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sid-unbekannt">Unbekannte Nummer</Label>
                <div className="flex gap-2">
                  <Input
                    id="sid-unbekannt"
                    value={config.whatsapp_template_sid_unbekannt}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev ? { ...prev, whatsapp_template_sid_unbekannt: e.target.value } : prev
                      )
                    }
                    placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      handleSave({
                        whatsapp_template_sid_unbekannt: config.whatsapp_template_sid_unbekannt,
                      })
                    }
                  >
                    {saving ? 'Speichert…' : 'Speichern'}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>

    <AlertDialog open={produktionsDialogOffen} onOpenChange={setProduktionsDialogOffen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>In Produktions-Modus wechseln?</AlertDialogTitle>
          <AlertDialogDescription>
            Im Produktions-Modus werden Nachrichten über die verifizierte Büronummer gesendet
            und Meta-genehmigte Templates verwendet. Alle Mitarbeiter ohne Sandbox-Registrierung
            sind damit erreichbar. Stelle sicher, dass alle Prüfungen in der Migrations-Checkliste
            bestanden sind.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setProduktionsDialogOffen(false)
              handleSave({ whatsapp_mode: 'production' })
            }}
          >
            Jetzt wechseln
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
