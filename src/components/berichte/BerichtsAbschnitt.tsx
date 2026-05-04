'use client'

import { GripVertical, Eye, EyeOff } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { AbschnittInBericht } from '@/types/berichte'

interface Props {
  abschnitt: AbschnittInBericht
  onChange: (updated: AbschnittInBericht) => void
}

export default function BerichtsAbschnitt({ abschnitt, onChange }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: abschnitt.begehungs_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function updateFoto(fotoId: string, patch: Partial<AbschnittInBericht['fotos'][0]>) {
    onChange({
      ...abschnitt,
      fotos: abschnitt.fotos.map((f) =>
        f.foto_id === fotoId ? { ...f, ...patch } : f
      ),
    })
  }

  const sichtbareFotos = [...abschnitt.fotos].sort((a, b) => a.reihenfolge - b.reihenfolge)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card transition-shadow ${
        abschnitt.sichtbar ? '' : 'opacity-50'
      }`}
    >
      {/* Abschnitts-Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Abschnitt verschieben"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <Input
          value={abschnitt.titel}
          onChange={(e) => onChange({ ...abschnitt, titel: e.target.value })}
          className="flex-1 font-semibold"
          aria-label="Abschnittstitel"
        />

        <div className="flex items-center gap-2 shrink-0">
          {abschnitt.sichtbar ? (
            <Eye className="h-4 w-4 text-muted-foreground" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <Switch
            id={`sichtbar-${abschnitt.begehungs_id}`}
            checked={abschnitt.sichtbar}
            onCheckedChange={(checked) => onChange({ ...abschnitt, sichtbar: checked })}
            aria-label="Abschnitt im Export anzeigen"
          />
          <Label
            htmlFor={`sichtbar-${abschnitt.begehungs_id}`}
            className="text-xs text-muted-foreground cursor-pointer"
          >
            {abschnitt.sichtbar ? 'Sichtbar' : 'Ausgeblendet'}
          </Label>
        </div>
      </div>

      {/* Freitext */}
      <div className="p-4 space-y-4">
        <Textarea
          value={abschnitt.freitext}
          onChange={(e) => onChange({ ...abschnitt, freitext: e.target.value })}
          placeholder="Leistungsstand, Vorkommnisse, Maßnahmen …"
          className="min-h-[100px] resize-y"
          aria-label="Freitext"
        />

        {/* Foto-Galerie */}
        {sichtbareFotos.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">
              Fotos ({sichtbareFotos.filter((f) => f.sichtbar).length} von {sichtbareFotos.length})
            </p>
            <div className="grid grid-cols-2 gap-3">
              {sichtbareFotos.map((foto) => (
                <div
                  key={foto.foto_id}
                  className={`group relative rounded-md border overflow-hidden transition-opacity ${
                    foto.sichtbar ? '' : 'opacity-40'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto.thumb_url}
                    alt={foto.bildunterschrift || 'Foto'}
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                  />

                  {/* Foto ausblenden Toggle */}
                  <div className="absolute right-1 top-1">
                    <button
                      type="button"
                      onClick={() => updateFoto(foto.foto_id, { sichtbar: !foto.sichtbar })}
                      className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
                      aria-label={foto.sichtbar ? 'Foto ausblenden' : 'Foto einblenden'}
                    >
                      {foto.sichtbar ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                    </button>
                  </div>

                  {/* Bildunterschrift */}
                  <div className="p-1.5">
                    <Input
                      value={foto.bildunterschrift}
                      onChange={(e) =>
                        updateFoto(foto.foto_id, { bildunterschrift: e.target.value })
                      }
                      placeholder="Bildunterschrift …"
                      className="h-7 text-xs"
                      aria-label="Bildunterschrift"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
