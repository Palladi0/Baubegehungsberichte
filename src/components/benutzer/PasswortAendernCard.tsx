'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

const schema = z
  .object({
    aktuelles_passwort: z.string().min(1, 'Bitte aktuelles Passwort eingeben.'),
    neues_passwort: z
      .string()
      .min(8, 'Das neue Passwort muss mindestens 8 Zeichen lang sein.'),
    passwort_bestaetigen: z.string(),
  })
  .refine((v) => v.neues_passwort === v.passwort_bestaetigen, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwort_bestaetigen'],
  })
  .refine((v) => v.neues_passwort !== v.aktuelles_passwort, {
    message: 'Das neue Passwort muss sich vom aktuellen unterscheiden.',
    path: ['neues_passwort'],
  })

type FormWerte = z.infer<typeof schema>

export function PasswortAendernCard() {
  const [istSenden, setIstSenden] = useState(false)
  const [fehlerNachricht, setFehlerNachricht] = useState<string | null>(null)

  const form = useForm<FormWerte>({
    resolver: zodResolver(schema),
    defaultValues: {
      aktuelles_passwort: '',
      neues_passwort: '',
      passwort_bestaetigen: '',
    },
  })

  async function onSubmit(werte: FormWerte) {
    setIstSenden(true)
    setFehlerNachricht(null)
    try {
      const antwort = await fetch('/api/benutzer/me/passwort', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(werte),
      })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Passwort konnte nicht geändert werden.')
      }
      toast.success('Passwort wurde erfolgreich geändert.')
      form.reset({
        aktuelles_passwort: '',
        neues_passwort: '',
        passwort_bestaetigen: '',
      })
    } catch (fehler) {
      const nachricht =
        fehler instanceof Error
          ? fehler.message
          : 'Passwort konnte nicht geändert werden.'
      setFehlerNachricht(nachricht)
    } finally {
      setIstSenden(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passwort ändern</CardTitle>
        <CardDescription>
          Zur Sicherheit wird das aktuelle Passwort zur Bestätigung abgefragt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {fehlerNachricht && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{fehlerNachricht}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="aktuelles_passwort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aktuelles Passwort</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
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
                  <FormLabel>Neues Passwort bestätigen</FormLabel>
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

            <div className="flex justify-end">
              <Button type="submit" disabled={istSenden}>
                {istSenden && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {istSenden ? 'Speichern...' : 'Passwort ändern'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
