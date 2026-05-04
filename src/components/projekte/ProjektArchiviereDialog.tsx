'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Props = {
  projektId: string | null
  projektName: string
  onSchliessen: () => void
  onErfolg: () => void
}

export function ProjektArchiviereDialog({ projektId, projektName, onSchliessen, onErfolg }: Props) {
  const [istLade, setIstLade] = useState(false)

  async function archivieren() {
    if (!projektId) return
    setIstLade(true)
    try {
      const antwort = await fetch(`/api/admin/projekte/${projektId}/archivieren`, {
        method: 'PATCH',
      })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        toast.error(body.error ?? 'Projekt konnte nicht archiviert werden.')
        return
      }
      toast.success(`Projekt „${projektName}" wurde archiviert.`)
      onErfolg()
    } catch {
      toast.error('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setIstLade(false)
    }
  }

  return (
    <AlertDialog open={projektId !== null} onOpenChange={(open) => !open && onSchliessen()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Projekt archivieren?</AlertDialogTitle>
          <AlertDialogDescription>
            Das Projekt <strong>{projektName}</strong> wird archiviert. Bestehende Berichte
            bleiben erhalten, aber neue Begehungen können nicht mehr gestartet werden.
            Diese Aktion kann durch einen Admin rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={istLade}>Abbrechen</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={archivieren}
            disabled={istLade}
            aria-label="Archivierung bestätigen"
          >
            {istLade && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Archivieren
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
