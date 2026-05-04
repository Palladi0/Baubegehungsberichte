'use client'

import { useState, useEffect } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { VorlageConfig } from '@/types/berichte'

interface VorlageAuswahlProps {
  berichtId: string
  aktuelleVorlageId: string | null
  onChange?: (vorlageId: string | null) => void
}

const STANDARD_SENTINEL = '__standard__'

export function VorlageAuswahl({ berichtId, aktuelleVorlageId, onChange }: VorlageAuswahlProps) {
  const [vorlagen, setVorlagen] = useState<VorlageConfig[]>([])
  const [ausgewaehlt, setAusgewaehlt] = useState<string>(aktuelleVorlageId ?? STANDARD_SENTINEL)
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data: VorlageConfig[]) => setVorlagen(data))
      .catch(() => { /* Vorlagen nicht kritisch */ })
  }, [])

  async function handleChange(value: string) {
    const neueVorlageId = value === STANDARD_SENTINEL ? null : value
    const vorherig = ausgewaehlt
    setAusgewaehlt(value)
    setFehler(null)
    setSpeichert(true)
    try {
      const res = await fetch(`/api/reports/${berichtId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vorlage_id: neueVorlageId }),
      })
      if (!res.ok) {
        setAusgewaehlt(vorherig)
        setFehler('Vorlage konnte nicht gespeichert werden.')
        return
      }
      onChange?.(neueVorlageId)
    } catch {
      setAusgewaehlt(vorherig)
      setFehler('Vorlage konnte nicht gespeichert werden.')
    } finally {
      setSpeichert(false)
    }
  }

  if (vorlagen.length === 0) return null

  const standardVorlage = vorlagen.find((v) => v.ist_standard)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <LayoutTemplate className="h-4 w-4 text-muted-foreground" aria-hidden />
        <Label htmlFor="vorlage-auswahl" className="text-sm whitespace-nowrap">
          Vorlage:
        </Label>
        <Select value={ausgewaehlt} onValueChange={handleChange} disabled={speichert}>
          <SelectTrigger id="vorlage-auswahl" className="h-8 w-48 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STANDARD_SENTINEL}>
              Standard{standardVorlage ? ` (${standardVorlage.name})` : ''}
            </SelectItem>
            {vorlagen.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}{v.ist_standard ? ' ★' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {fehler && (
        <p className="text-xs text-destructive pl-6">{fehler}</p>
      )}
    </div>
  )
}
