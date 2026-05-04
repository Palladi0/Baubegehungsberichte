'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, LayoutTemplate } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { VorlagenKarte } from './VorlagenKarte'
import type { VorlageConfig } from '@/types/berichte'

export function VorlagenListe() {
  const router = useRouter()
  const [vorlagen, setVorlagen] = useState<VorlageConfig[]>([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = useCallback(async () => {
    setLaedt(true)
    setFehler(null)
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as VorlageConfig[]
      setVorlagen(data)
    } catch {
      setFehler('Vorlagen konnten nicht geladen werden.')
    } finally {
      setLaedt(false)
    }
  }, [])

  useEffect(() => { laden() }, [laden])

  function handleStandardGesetzt(id: string) {
    setVorlagen((prev) =>
      prev.map((v) => ({ ...v, ist_standard: v.id === id }))
    )
  }

  function handleGeloescht(id: string) {
    setVorlagen((prev) => prev.filter((v) => v.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Berichtsvorlagen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verwalte Layout, Farben und Logo für deine Berichte.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={laden} disabled={laedt} aria-label="Neu laden">
            <RefreshCw className={`h-4 w-4 ${laedt ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => router.push('/admin/vorlagen/neu')}>
            <Plus className="mr-1.5 h-4 w-4" />
            Neue Vorlage
          </Button>
        </div>
      </div>

      {/* Fehler */}
      {fehler && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{fehler}</span>
            <Button variant="ghost" size="sm" onClick={laden}>Erneut versuchen</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Inhalt */}
      {laedt ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : vorlagen.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <LayoutTemplate className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Keine Vorlagen vorhanden</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lege eine neue Vorlage an, um loszulegen.
          </p>
          <Button className="mt-4" onClick={() => router.push('/admin/vorlagen/neu')}>
            <Plus className="mr-1.5 h-4 w-4" />
            Erste Vorlage erstellen
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vorlagen.map((v) => (
            <VorlagenKarte
              key={v.id}
              vorlage={v}
              onStandardGesetzt={handleStandardGesetzt}
              onGeloescht={handleGeloescht}
            />
          ))}
        </div>
      )}
    </div>
  )
}
