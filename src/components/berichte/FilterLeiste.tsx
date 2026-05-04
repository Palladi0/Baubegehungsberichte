'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'

export interface FilterZustand {
  projekt_id: string
  von: string
  bis: string
  status: string
  suche: string
  sortierung: string
}

interface FilterLeisteProps {
  filter: FilterZustand
  projekte: { id: string; name: string; kuerzel: string }[]
  onChange: (filter: FilterZustand) => void
  onZurücksetzen: () => void
}

const SORTIERUNGEN = [
  { value: 'datum_desc', label: 'Datum (neueste zuerst)' },
  { value: 'datum_asc', label: 'Datum (älteste zuerst)' },
  { value: 'projekt', label: 'Projekt (A–Z)' },
  { value: 'ersteller', label: 'Ersteller (A–Z)' },
]

const STATUS_OPTIONEN = [
  { value: 'alle', label: 'Alle Status' },
  { value: 'entwurf', label: 'Entwurf' },
  { value: 'fertig', label: 'Fertig' },
]

export function FilterLeiste({ filter, projekte, onChange, onZurücksetzen }: FilterLeisteProps) {
  const istGefiltert =
    filter.projekt_id !== '' ||
    filter.von !== '' ||
    filter.bis !== '' ||
    filter.status !== '' ||
    filter.suche !== ''

  function set(feld: keyof FilterZustand, wert: string) {
    onChange({ ...filter, [feld]: wert })
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Suche */}
        <div className="space-y-1 lg:col-span-1">
          <Label htmlFor="suche-input" className="text-xs text-muted-foreground">
            Suche
          </Label>
          <Input
            id="suche-input"
            placeholder="Projektname …"
            value={filter.suche}
            onChange={(e) => set('suche', e.target.value)}
            aria-label="Berichte durchsuchen"
          />
        </div>

        {/* Projekt */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Projekt</Label>
          <Select
            value={filter.projekt_id || 'alle'}
            onValueChange={(v) => set('projekt_id', v === 'alle' ? '' : v)}
          >
            <SelectTrigger aria-label="Projekt filtern">
              <SelectValue placeholder="Alle Projekte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Projekte</SelectItem>
              {projekte.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.kuerzel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filter.status || 'alle'}
            onValueChange={(v) => set('status', v === 'alle' ? '' : v)}
          >
            <SelectTrigger aria-label="Status filtern">
              <SelectValue placeholder="Alle Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONEN.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sortierung */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Sortierung</Label>
          <Select
            value={filter.sortierung}
            onValueChange={(v) => set('sortierung', v)}
          >
            <SelectTrigger aria-label="Sortierung auswählen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTIERUNGEN.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Datumsbereich */}
        <div className="space-y-1">
          <Label htmlFor="von-input" className="text-xs text-muted-foreground">
            Datum von
          </Label>
          <Input
            id="von-input"
            type="date"
            value={filter.von}
            onChange={(e) => set('von', e.target.value)}
            aria-label="Datum von"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="bis-input" className="text-xs text-muted-foreground">
            Datum bis
          </Label>
          <Input
            id="bis-input"
            type="date"
            value={filter.bis}
            onChange={(e) => set('bis', e.target.value)}
            aria-label="Datum bis"
          />
        </div>

        {/* Filter zurücksetzen */}
        {istGefiltert && (
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onZurücksetzen}
              className="gap-1.5 text-muted-foreground"
            >
              <X className="h-4 w-4" />
              Filter zurücksetzen
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
