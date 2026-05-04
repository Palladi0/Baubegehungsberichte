'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Star, Trash2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import type { VorlageConfig } from '@/types/berichte'

interface VorlagenKarteProps {
  vorlage: VorlageConfig
  onStandardGesetzt: (id: string) => void
  onGeloescht: (id: string) => void
}

export function VorlagenKarte({ vorlage, onStandardGesetzt, onGeloescht }: VorlagenKarteProps) {
  const router = useRouter()
  const [loeseLoading, setLoeseLoading] = useState(false)
  const [standardLoading, setStandardLoading] = useState(false)
  const [loeschFehler, setLoeschFehler] = useState<string | null>(null)
  const [loeschDialogOffen, setLoeschDialogOffen] = useState(false)

  async function handleAlsStandard() {
    setStandardLoading(true)
    try {
      const res = await fetch(`/api/templates/${vorlage.id}/default`, { method: 'PUT' })
      if (res.ok) onStandardGesetzt(vorlage.id)
    } finally {
      setStandardLoading(false)
    }
  }

  async function handleLoeschen() {
    setLoeseLoading(true)
    setLoeschFehler(null)
    try {
      const res = await fetch(`/api/templates/${vorlage.id}`, { method: 'DELETE' })
      if (res.ok) {
        onGeloescht(vorlage.id)
      } else {
        const json = await res.json().catch(() => ({}))
        setLoeschFehler(json.error ?? 'Löschen fehlgeschlagen.')
      }
    } finally {
      setLoeseLoading(false)
    }
  }

  const schriftLabel: Record<string, string> = { klein: 'Klein', mittel: 'Mittel', gross: 'Groß' }

  return (
    <>
      <Card className="flex flex-col">
        {/* Farbvorschau-Streifen */}
        <div
          className="h-2 w-full rounded-t-lg"
          style={{ background: `linear-gradient(90deg, ${vorlage.primaerfarbe} 50%, ${vorlage.sekundaerfarbe} 100%)` }}
        />

        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{vorlage.name}</CardTitle>
              {vorlage.ist_standard && (
                <Badge variant="default" className="text-xs">Standard</Badge>
              )}
            </div>
            {vorlage.firmenname && (
              <p className="text-xs text-muted-foreground">{vorlage.firmenname}</p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Aktionen">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/admin/vorlagen/${vorlage.id}/bearbeiten`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Bearbeiten
              </DropdownMenuItem>
              {!vorlage.ist_standard && (
                <DropdownMenuItem onClick={handleAlsStandard} disabled={standardLoading}>
                  {standardLoading
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Star className="mr-2 h-4 w-4" />}
                  Als Standard markieren
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setLoeschDialogOffen(true)}
                disabled={vorlage.ist_standard}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="space-y-2 pb-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <span
                className="h-4 w-4 rounded border border-border"
                style={{ background: vorlage.primaerfarbe }}
              />
              <span className="font-mono text-xs text-muted-foreground">{vorlage.primaerfarbe}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-4 w-4 rounded border border-border"
                style={{ background: vorlage.sekundaerfarbe }}
              />
              <span className="font-mono text-xs text-muted-foreground">{vorlage.sekundaerfarbe}</span>
            </div>
          </div>

          {vorlage.logo_url && (
            <img
              src={vorlage.logo_url}
              alt="Logo"
              className="h-8 max-w-[120px] object-contain"
            />
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between pt-0">
          <span className="text-xs text-muted-foreground">
            Schrift: {schriftLabel[vorlage.schriftgroesse] ?? vorlage.schriftgroesse}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/vorlagen/${vorlage.id}/bearbeiten`)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Bearbeiten
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={loeschDialogOffen} onOpenChange={(open) => { setLoeschDialogOffen(open); if (!open) setLoeschFehler(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Vorlage „{vorlage.name}" wird dauerhaft gelöscht. Berichte, die diese Vorlage
              noch referenzieren, können nicht gelöscht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {loeschFehler && (
            <p className="text-sm text-destructive px-1">{loeschFehler}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLoeschen}
              disabled={loeseLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loeseLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
