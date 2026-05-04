'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ProjektEintrag } from './types'

const schema = z.object({
  name: z.string().min(1, 'Projektname ist erforderlich').max(200),
  nummer: z.string().min(1, 'Projektnummer ist erforderlich').max(50),
  kuerzel: z
    .string()
    .min(1, 'Projektkürzel ist erforderlich')
    .max(20, 'Maximal 20 Zeichen')
    .regex(/^[A-Za-z0-9-]+$/, 'Nur Buchstaben, Zahlen und Bindestriche erlaubt'),
  auftraggeber: z.string().max(200).optional(),
  bauherr: z.string().max(200).optional(),
  adresse: z.string().max(500).optional(),
  start_datum: z.string().optional(),
  end_datum: z.string().optional(),
  beschreibung: z.string().max(2000).optional(),
})

type FormWerte = z.infer<typeof schema>

type Props = {
  offen: boolean
  onOffenChange: (offen: boolean) => void
  onErfolg: (projekt: ProjektEintrag) => void
}

export function NeueProjektDialog({ offen, onOffenChange, onErfolg }: Props) {
  const [fehler, setFehler] = useState<string | null>(null)

  const form = useForm<FormWerte>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      nummer: '',
      kuerzel: '',
      auftraggeber: '',
      bauherr: '',
      adresse: '',
      start_datum: '',
      end_datum: '',
      beschreibung: '',
    },
  })

  const istLade = form.formState.isSubmitting

  async function onSubmit(werte: FormWerte) {
    setFehler(null)
    try {
      const antwort = await fetch('/api/admin/projekte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...werte,
          auftraggeber: werte.auftraggeber || null,
          bauherr: werte.bauherr || null,
          adresse: werte.adresse || null,
          start_datum: werte.start_datum || null,
          end_datum: werte.end_datum || null,
          beschreibung: werte.beschreibung || null,
        }),
      })
      const body = await antwort.json()
      if (!antwort.ok) {
        setFehler(body.error ?? 'Projekt konnte nicht angelegt werden.')
        return
      }
      form.reset()
      onErfolg(body as ProjektEintrag)
    } catch {
      setFehler('Netzwerkfehler. Bitte erneut versuchen.')
    }
  }

  function handleOffenChange(open: boolean) {
    if (!open) {
      form.reset()
      setFehler(null)
    }
    onOffenChange(open)
  }

  return (
    <Dialog open={offen} onOpenChange={handleOffenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neues Projekt anlegen</DialogTitle>
          <DialogDescription>
            Pflichtfelder: Name, Nummer und Kürzel. Das Kürzel wird später als
            WhatsApp-Hashtag verwendet (z.&nbsp;B.&nbsp;
            <code className="font-mono text-xs">#BV-23-Hamburg</code>).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projektname *</FormLabel>
                  <FormControl>
                    <Input placeholder="z. B. Neubau Wohnanlage Musterstraße" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="nummer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projektnummer *</FormLabel>
                    <FormControl>
                      <Input placeholder="z. B. 2023-045" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kuerzel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kürzel *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z. B. BV-23-HH"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase().replace(/\s/g, '-'))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="auftraggeber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auftraggeber</FormLabel>
                  <FormControl>
                    <Input placeholder="z. B. Mustermann GmbH" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bauherr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bauherr</FormLabel>
                  <FormControl>
                    <Input placeholder="z. B. Stadt Hamburg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adresse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projektadresse</FormLabel>
                  <FormControl>
                    <Input placeholder="z. B. Musterstraße 1, 20099 Hamburg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_datum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Startdatum</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_datum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enddatum</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="beschreibung"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Kurze Projektbeschreibung …"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {fehler && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{fehler}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOffenChange(false)}
                disabled={istLade}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={istLade} aria-label="Projekt speichern">
                {istLade && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Projekt anlegen
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
