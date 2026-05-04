'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { NutzerEintrag } from './BenutzertabelleCard'

const schema = z
  .object({
    neues_passwort: z
      .string()
      .min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein.'),
    passwort_bestaetigen: z.string(),
  })
  .refine((v) => v.neues_passwort === v.passwort_bestaetigen, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwort_bestaetigen'],
  })

type FormWerte = z.infer<typeof schema>

type PasswortZuruecksetzenDialogProps = {
  nutzer: NutzerEintrag | null
  onSchliessen: () => void
}

export function PasswortZuruecksetzenDialog({
  nutzer,
  onSchliessen,
}: PasswortZuruecksetzenDialogProps) {
  const [istSenden, setIstSenden] = useState(false)
  const [fehlerNachricht, setFehlerNachricht] = useState<string | null>(null)

  const form = useForm<FormWerte>({
    resolver: zodResolver(schema),
    defaultValues: { neues_passwort: '', passwort_bestaetigen: '' },
  })

  useEffect(() => {
    if (!nutzer) {
      form.reset({ neues_passwort: '', passwort_bestaetigen: '' })
      setFehlerNachricht(null)
      setIstSenden(false)
    }
  }, [nutzer, form])

  async function onSubmit(werte: FormWerte) {
    if (!nutzer) return
    setIstSenden(true)
    setFehlerNachricht(null)
    try {
      const antwort = await fetch(
        `/api/admin/benutzer/${nutzer.id}/passwort-reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ neues_passwort: werte.neues_passwort }),
        }
      )
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Passwort konnte nicht zurückgesetzt werden.')
      }
      toast.success(`Passwort für ${nutzer.email} wurde zurückgesetzt.`)
      onSchliessen()
    } catch (fehler) {
      const nachricht =
        fehler instanceof Error
          ? fehler.message
          : 'Passwort konnte nicht zurückgesetzt werden.'
      setFehlerNachricht(nachricht)
    } finally {
      setIstSenden(false)
    }
  }

  return (
    <Dialog
      open={nutzer !== null}
      onOpenChange={(offen) => {
        if (!offen) onSchliessen()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Passwort zurücksetzen</DialogTitle>
          <DialogDescription>
            {nutzer
              ? `Neues Passwort für ${nutzer.email} festlegen. Der Nutzer sollte es nach dem nächsten Login im Profil ändern.`
              : 'Neues Passwort festlegen.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {fehlerNachricht && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{fehlerNachricht}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="neues_passwort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Neues Passwort</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mindestens 8 Zeichen"
                      disabled={istSenden}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="passwort_bestaetigen"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passwort bestätigen</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      disabled={istSenden}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={onSchliessen}
                disabled={istSenden}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={istSenden}>
                {istSenden && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {istSenden ? 'Speichern...' : 'Passwort setzen'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
