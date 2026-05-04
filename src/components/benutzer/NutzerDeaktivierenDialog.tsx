'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import type { NutzerEintrag } from './BenutzertabelleCard'

type NutzerDeaktivierenDialogProps = {
  nutzer: NutzerEintrag | null
  onSchliessen: () => void
  onErfolg: () => void
}

export function NutzerDeaktivierenDialog({
  nutzer,
  onSchliessen,
  onErfolg,
}: NutzerDeaktivierenDialogProps) {
  const [istSenden, setIstSenden] = useState(false)

  async function handleDeaktivieren(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (!nutzer) return
    setIstSenden(true)
    try {
      const antwort = await fetch(`/api/admin/benutzer/${nutzer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktiv: false }),
      })
      if (!antwort.ok) {
        const body = await antwort.json().catch(() => ({}))
        throw new Error(body.error ?? 'Nutzer konnte nicht deaktiviert werden.')
      }
      toast.success(`${nutzer.email} wurde deaktiviert.`)
      onErfolg()
    } catch (fehler) {
      const nachricht =
        fehler instanceof Error
          ? fehler.message
          : 'Nutzer konnte nicht deaktiviert werden.'
      toast.error(nachricht)
    } finally {
      setIstSenden(false)
    }
  }

  return (
    <AlertDialog
      open={nutzer !== null}
      onOpenChange={(offen) => {
        if (!offen && !istSenden) onSchliessen()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nutzer deaktivieren?</AlertDialogTitle>
          <AlertDialogDescription>
            {nutzer
              ? `Möchten Sie den Account von ${nutzer.email} wirklich deaktivieren? Der Nutzer kann sich nach dem Deaktivieren nicht mehr einloggen. Die Aktion lässt sich jederzeit rückgängig machen.`
              : 'Möchten Sie diesen Nutzer wirklich deaktivieren?'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={istSenden}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeaktivieren}
            disabled={istSenden}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {istSenden && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {istSenden ? 'Deaktivieren...' : 'Deaktivieren'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
