'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Teilnehmer } from './types'

interface TeilnehmerListeProps {
  teilnehmer: Teilnehmer[]
  onChange: (liste: Teilnehmer[]) => void
  disabled?: boolean
}

export function TeilnehmerListe({ teilnehmer, onChange, disabled }: TeilnehmerListeProps) {
  function handleFeldChange(id: string, feld: 'name' | 'rolle', wert: string) {
    onChange(teilnehmer.map((t) => (t.id === id ? { ...t, [feld]: wert } : t)))
  }

  function handleHinzufuegen() {
    const neuerEintrag: Teilnehmer = {
      id: crypto.randomUUID(),
      name: '',
      rolle: '',
    }
    onChange([...teilnehmer, neuerEintrag])
  }

  function handleEntfernen(id: string) {
    onChange(teilnehmer.filter((t) => t.id !== id))
  }

  return (
    <div className="space-y-3" aria-label="Teilnehmerliste">
      {teilnehmer.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Noch keine Teilnehmer eingetragen.
        </p>
      )}

      {teilnehmer.map((t, index) => (
        <div key={t.id} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            {index === 0 && (
              <Label className="text-xs text-muted-foreground">Name</Label>
            )}
            <Input
              value={t.name}
              onChange={(e) => handleFeldChange(t.id, 'name', e.target.value)}
              placeholder="Vollständiger Name"
              disabled={disabled}
              aria-label={`Name Teilnehmer ${index + 1}`}
            />
          </div>
          <div className="flex-1 space-y-1">
            {index === 0 && (
              <Label className="text-xs text-muted-foreground">Rolle</Label>
            )}
            <Input
              value={t.rolle}
              onChange={(e) => handleFeldChange(t.id, 'rolle', e.target.value)}
              placeholder="z. B. Bauleiter"
              disabled={disabled}
              aria-label={`Rolle Teilnehmer ${index + 1}`}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleEntfernen(t.id)}
            disabled={disabled}
            aria-label={`Teilnehmer ${t.name || index + 1} entfernen`}
            className="shrink-0 mb-0"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleHinzufuegen}
        disabled={disabled}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Teilnehmer hinzufügen
      </Button>
    </div>
  )
}
