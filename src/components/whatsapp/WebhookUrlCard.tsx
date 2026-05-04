'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function WebhookUrlCard() {
  const [kopiert, setKopiert] = useState(false)

  const webhookUrl =
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`
      : typeof window !== 'undefined'
        ? `${window.location.origin}/api/webhooks/twilio`
        : '/api/webhooks/twilio'

  async function handleKopieren() {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setKopiert(true)
      setTimeout(() => setKopiert(false), 2000)
    } catch {
      // Fallback: select text
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Twilio Webhook-URL</CardTitle>
        <CardDescription>
          Trage diese URL in der Twilio Console unter „Messaging → Sandbox → When a message comes in" ein.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Webhook-Endpunkt</Label>
          <div className="flex gap-2">
            <Input
              id="webhook-url"
              value={webhookUrl}
              readOnly
              className="font-mono text-sm"
              aria-label="Twilio Webhook-URL"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleKopieren}
              aria-label="URL kopieren"
            >
              {kopiert ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            HTTP-Methode: <span className="font-mono">POST</span> · Signatur-Validierung: HMAC-SHA1
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
