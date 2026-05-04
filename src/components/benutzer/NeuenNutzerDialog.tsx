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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const schema = z.object({
  email: z.string().email('Bitte eine gültige E-Mail-Adresse eingeben.'),
  rolle: z.enum(['admin', 'mitarbeiter']),
  passwort: z.string().min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein.'),
})

type FormWerte = z.infer<typeof schema>

type NeuenNutzerDialogProps = {
  offen: boolean
  onOffenChange: (offen: boolean) => void
  onErfolg: () => void
}

export function NeuenNutzerDialog({
  offen,
  onOffenChange,
  onErfolg,
}: NeuenNutzerDialogProps) {
  const [istSenden, setIstSenden] = useState(false)
  const [fehlerNachricht, setFehlerNachricht] = useState<string | null>(null)

  const form = useForm<FormWerte>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', rolle: 'mitarbeiter', passwort: '' },
  })

  useEffect(() => {
    if (!offen) {
      form.reset({ email: '', rolle: 'mitarbeiter', passwort: '' })
      setFehlerNachricht(null)
      setIstSenden(false)
    }
  }, [offen, form])

  async function onSubmit(werte: FormWerte) {
    setIstSenden(true)
    setFehlerNachricht(null)
    try {
      const antwort = await fetch('/api/admin/benutzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(werte),
      })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Nutzer konnte nicht angelegt werden.')
      }
      toast.success(`Nutzer ${werte.email} wurde angelegt.`)
      onErfolg()
    } catch (fehler) {
      const nachricht =
        fehler instanceof Error
          ? fehler.message
          : 'Nutzer konnte nicht angelegt werden.'
      setFehlerNachricht(nachricht)
    } finally {
      setIstSenden(false)
    }
  }

  return (
    <Dialog open={offen} onOpenChange={onOffenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Nutzer anlegen</DialogTitle>
          <DialogDescription>
            Lege ein neues Konto mit E-Mail, Rolle und initialem Passwort an.
            Der Nutzer kann das Passwort später im Profil ändern.
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="name@buero.de"
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
              name="rolle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolle</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={istSenden}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Rolle auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="passwort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initiales Passwort</FormLabel>
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

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOffenChange(false)}
                disabled={istSenden}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={istSenden}>
                {istSenden && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {istSenden ? 'Anlegen...' : 'Nutzer anlegen'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
