'use client'

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

interface LöschDialogProps {
  offen: boolean
  projektName: string
  begehungsDatum: string
  löscht: boolean
  onBestätigen: () => void
  onAbbrechen: () => void
}

export function LöschDialog({
  offen,
  projektName,
  begehungsDatum,
  löscht,
  onBestätigen,
  onAbbrechen,
}: LöschDialogProps) {
  const datum = new Date(begehungsDatum).toLocaleDateString('de-DE', { dateStyle: 'long' })

  return (
    <AlertDialog open={offen} onOpenChange={(o) => { if (!o) onAbbrechen() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bericht löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Der Bericht <strong>{projektName}</strong> vom {datum} sowie das zugehörige PDF
            werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={löscht}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={onBestätigen}
            disabled={löscht}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {löscht ? 'Wird gelöscht …' : 'Endgültig löschen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
