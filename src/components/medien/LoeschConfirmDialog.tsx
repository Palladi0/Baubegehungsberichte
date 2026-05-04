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
import { Loader2 } from 'lucide-react'

interface Props {
  offen: boolean
  laedtLoeschen: boolean
  onAbbrechen: () => void
  onBestaetigen: () => void
}

export function LoeschConfirmDialog({ offen, laedtLoeschen, onAbbrechen, onBestaetigen }: Props) {
  return (
    <AlertDialog open={offen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Foto löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Das Foto wird aus der Galerie entfernt. Bereits generierte PDFs bleiben unverändert.
            Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onAbbrechen} disabled={laedtLoeschen}>
            Abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onBestaetigen}
            disabled={laedtLoeschen}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {laedtLoeschen ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Wird gelöscht…</>
            ) : (
              'Endgültig löschen'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
