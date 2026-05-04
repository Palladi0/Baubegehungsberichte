'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, ExternalLink, Download, FileDown, RefreshCw, Copy, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { LöschDialog } from './LöschDialog'
import type { BerichtListItem } from '@/types/berichte'

interface AktionenDropdownProps {
  bericht: BerichtListItem
  kannLöschen: boolean
  onGelöscht: () => void
}

export function AktionenDropdown({ bericht, kannLöschen, onGelöscht }: AktionenDropdownProps) {
  const router = useRouter()
  const [löschDialogOffen, setLöschDialogOffen] = useState(false)
  const [löscht, setLöscht] = useState(false)
  const [dupliziert, setDupliziert] = useState(false)
  const [exportiert, setExportiert] = useState(false)

  const hatPdf = !!bericht.pdf_pfad
  const pdfVeraltet =
    bericht.pdf_versions_nr != null &&
    bericht.pdf_versions_nr < bericht.aktuelle_version_nr

  async function handleLöschen() {
    setLöscht(true)
    try {
      const res = await fetch(`/api/reports/${bericht.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Bericht konnte nicht gelöscht werden.')
        return
      }
      toast.success('Bericht gelöscht.')
      setLöschDialogOffen(false)
      onGelöscht()
    } catch {
      toast.error('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setLöscht(false)
    }
  }

  async function handleExport() {
    setExportiert(true)
    const toastId = toast.loading('PDF wird generiert …')
    try {
      const res = await fetch(`/api/reports/${bericht.id}/export`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? 'PDF-Generierung fehlgeschlagen.', { id: toastId })
        return
      }
      toast.success('PDF erstellt.', { id: toastId })
      // Direkt herunterladen
      const link = document.createElement('a')
      link.href = `/api/reports/${bericht.id}/download`
      link.download = body.dateiname ?? ''
      link.click()
      onGelöscht() // Reload für aktualisierte PDF-Felder
    } catch {
      toast.error('Netzwerkfehler – bitte erneut versuchen.', { id: toastId })
    } finally {
      setExportiert(false)
    }
  }

  async function handleDuplizieren() {
    setDupliziert(true)
    try {
      const res = await fetch(`/api/reports/${bericht.id}/duplicate`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? 'Duplizieren fehlgeschlagen.')
        return
      }
      toast.success('Bericht dupliziert.')
      onGelöscht() // Nutze als generischen Reload-Trigger
      router.push(`/berichte/${body.id}`)
    } catch {
      toast.error('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setDupliziert(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Aktionen">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/berichte/${bericht.id}`)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Öffnen
          </DropdownMenuItem>

          {/* PDF herunterladen — immer sichtbar, deaktiviert+Tooltip wenn kein PDF (BUG-5) */}
          <DropdownMenuItem
            disabled={!hatPdf}
            title={!hatPdf ? 'Noch kein PDF verfügbar' : undefined}
            onClick={() => {
              if (hatPdf) window.open(`/api/reports/${bericht.id}/download`, '_blank')
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            PDF herunterladen
          </DropdownMenuItem>

          {/* PDF generieren — wenn noch kein PDF vorhanden */}
          {!hatPdf && (
            <DropdownMenuItem onClick={handleExport} disabled={exportiert}>
              {exportiert ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              PDF generieren
            </DropdownMenuItem>
          )}

          {/* Neu generieren — wenn PDF veraltet */}
          {hatPdf && pdfVeraltet && (
            <DropdownMenuItem onClick={handleExport} disabled={exportiert}>
              {exportiert ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              PDF neu generieren
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleDuplizieren} disabled={dupliziert}>
            {dupliziert ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Duplizieren
          </DropdownMenuItem>

          {kannLöschen && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setLöschDialogOffen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <LöschDialog
        offen={löschDialogOffen}
        projektName={bericht.projekt_name}
        begehungsDatum={bericht.begehungs_datum}
        löscht={löscht}
        onBestätigen={handleLöschen}
        onAbbrechen={() => setLöschDialogOffen(false)}
      />
    </>
  )
}
