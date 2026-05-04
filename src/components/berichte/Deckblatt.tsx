'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { Deckblatt as DeckblattTyp } from '@/types/berichte'

interface Props {
  deckblatt: DeckblattTyp
  onChange: (updated: DeckblattTyp) => void
  readOnly?: boolean
}

function formatiereDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'long' })
  } catch {
    return iso
  }
}

export default function Deckblatt({ deckblatt, onChange, readOnly = false }: Props) {
  function set<K extends keyof DeckblattTyp>(key: K, value: DeckblattTyp[K]) {
    onChange({ ...deckblatt, [key]: value })
  }

  return (
    <div className="space-y-6 rounded-lg border bg-card p-6">
      {/* Logo / Firmenname */}
      <div>
        {deckblatt.firmenlogo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deckblatt.firmenlogo_url}
            alt="Firmenlogo"
            className="max-h-16 max-w-[200px] object-contain"
          />
        ) : (
          <p className="text-lg font-bold text-muted-foreground">[Firmenname]</p>
        )}
      </div>

      <Separator />

      {/* Berichtstitel */}
      <div>
        <h2 className="text-xl font-bold">
          Baustellenbegehung – {deckblatt.projektname}
        </h2>
        <p className="text-sm text-muted-foreground">Projektnummer: {deckblatt.projektnummer}</p>
      </div>

      {/* Meta-Zeilen */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Datum der Begehung</Label>
          <p className="text-sm font-medium">{formatiereDatum(deckblatt.datum)}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Uhrzeit</Label>
          <p className="text-sm font-medium">{deckblatt.uhrzeit} Uhr</p>
        </div>

        {/* Wetter — editierbar */}
        <div>
          <Label htmlFor="deckblatt-wetter" className="text-xs text-muted-foreground">
            Wetterbedingungen
          </Label>
          {readOnly ? (
            <p className="text-sm">{deckblatt.wetter ?? '—'}</p>
          ) : (
            <Input
              id="deckblatt-wetter"
              value={deckblatt.wetter ?? ''}
              onChange={(e) => set('wetter', e.target.value || null)}
              placeholder="z. B. Sonnig"
              className="mt-1 h-8 text-sm"
            />
          )}
        </div>
        <div>
          <Label htmlFor="deckblatt-temp" className="text-xs text-muted-foreground">
            Temperatur (°C)
          </Label>
          {readOnly ? (
            <p className="text-sm">
              {deckblatt.temperatur != null ? `${deckblatt.temperatur} °C` : '—'}
            </p>
          ) : (
            <Input
              id="deckblatt-temp"
              type="number"
              value={deckblatt.temperatur ?? ''}
              onChange={(e) =>
                set('temperatur', e.target.value ? parseFloat(e.target.value) : null)
              }
              placeholder="z. B. 18"
              className="mt-1 h-8 text-sm"
            />
          )}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Erstellt am</Label>
          <p className="text-sm">{formatiereDatum(deckblatt.erstellt_am)}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Erstellt von</Label>
          <p className="text-sm">{deckblatt.ersteller_name}</p>
        </div>
      </div>

      {/* Teilnehmer */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Anwesende Personen
        </Label>
        {deckblatt.teilnehmer.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground italic">Keine Teilnehmer angegeben</p>
        ) : (
          <ol className="mt-2 space-y-1 list-decimal list-inside">
            {deckblatt.teilnehmer.map((t, i) => (
              <li key={i} className="text-sm">
                {t.name}
                {t.rolle && (
                  <span className="ml-1 text-muted-foreground italic">({t.rolle})</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
