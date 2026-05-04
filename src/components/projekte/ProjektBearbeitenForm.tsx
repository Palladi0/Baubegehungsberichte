'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ProjektArchiviereDialog } from './ProjektArchiviereDialog'
import type { ProjektEintrag } from './types'

const schema = z.object({
  name: z.string().min(1, 'Projektname ist erforderlich').max(200),
  nummer: z.string().min(1, 'Projektnummer ist erforderlich').max(50),
  kuerzel: z
    .string()
    .min(1, 'Projektkürzel ist erforderlich')
    .max(20)
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
  projekt: ProjektEintrag
}

export function ProjektBearbeitenForm({ projekt }: Props) {
  const router = useRouter()
  const [fehler, setFehler] = useState<string | null>(null)
  const [archiviereOffen, setArchiviereOffen] = useState(false)

  const form = useForm<FormWerte>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: projekt.name,
      nummer: projekt.nummer,
      kuerzel: projekt.kuerzel,
      auftraggeber: projekt.auftraggeber ?? '',
      bauherr: projekt.bauherr ?? '',
      adresse: projekt.adresse ?? '',
      start_datum: projekt.start_datum ?? '',
      end_datum: projekt.end_datum ?? '',
      beschreibung: projekt.beschreibung ?? '',
    },
  })

  const istLade = form.formState.isSubmitting
  const istArchiviert = projekt.archived_at !== null

  async function onSubmit(werte: FormWerte) {
    setFehler(null)
    try {
      const antwort = await fetch(`/api/admin/projekte/${projekt.id}`, {
        method: 'PUT',
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
        setFehler(body.error ?? 'Projekt konnte nicht gespeichert werden.')
        return
      }
      toast.success('Projekt wurde gespeichert.')
      router.refresh()
    } catch {
      setFehler('Netzwerkfehler. Bitte erneut versuchen.')
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle>Projektdetails</CardTitle>
              {istArchiviert && <Badge variant="secondary">Archiviert</Badge>}
            </div>
            <CardDescription>
              Stammdaten des Projekts bearbeiten.
            </CardDescription>
          </div>
          {!istArchiviert && (
            <Button
              variant="outline"
              size="sm"
              className="sm:shrink-0 text-destructive hover:text-destructive"
              onClick={() => setArchiviereOffen(true)}
              aria-label="Projekt archivieren"
            >
              <Archive className="mr-1.5 h-4 w-4" />
              Archivieren
            </Button>
          )}
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projektname *</FormLabel>
                    <FormControl>
                      <Input disabled={istArchiviert} {...field} />
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
                        <Input disabled={istArchiviert} {...field} />
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
                          disabled={istArchiviert}
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

              <Separator />

              <FormField
                control={form.control}
                name="auftraggeber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auftraggeber</FormLabel>
                    <FormControl>
                      <Input disabled={istArchiviert} {...field} />
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
                      <Input disabled={istArchiviert} {...field} />
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
                      <Input disabled={istArchiviert} {...field} />
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
                        <Input type="date" disabled={istArchiviert} {...field} />
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
                        <Input type="date" disabled={istArchiviert} {...field} />
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
                      <Textarea rows={4} disabled={istArchiviert} {...field} />
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
            </CardContent>

            {!istArchiviert && (
              <CardFooter className="justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  disabled={istLade || !form.formState.isDirty}
                >
                  Zurücksetzen
                </Button>
                <Button type="submit" disabled={istLade || !form.formState.isDirty}>
                  {istLade && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Speichern
                </Button>
              </CardFooter>
            )}
          </form>
        </Form>
      </Card>

      <ProjektArchiviereDialog
        projektId={archiviereOffen ? projekt.id : null}
        projektName={projekt.name}
        onSchliessen={() => setArchiviereOffen(false)}
        onErfolg={() => {
          setArchiviereOffen(false)
          router.push('/admin/projekte')
        }}
      />
    </>
  )
}
