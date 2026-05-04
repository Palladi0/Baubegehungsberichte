'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Foto } from './types'

interface Props {
  foto: Foto
  kannLoeschen: boolean
  onBearbeiten: (foto: Foto) => void
  onLoeschen: (foto: Foto) => void
}

function formatiereDatum(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'short' })
}

function uploaderName(uploader: Foto['uploader']) {
  if (!uploader) return '—'
  const name = [uploader.vorname, uploader.nachname].filter(Boolean).join(' ')
  return name || uploader.email
}

export function FotoKachel({ foto, kannLoeschen, onBearbeiten, onLoeschen }: Props) {
  const [bildFehler, setBildFehler] = useState(false)

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {bildFehler ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Bild nicht verfügbar
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/file/${foto.id}?v=thumb`}
            alt={foto.bildunterschrift ?? foto.original_dateiname}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={() => setBildFehler(true)}
            loading="lazy"
          />
        )}

        {/* Hover-Aktionen */}
        <div className="absolute inset-0 flex items-end justify-end gap-1.5 p-2 opacity-0 transition-opacity group-hover:opacity-100 bg-gradient-to-t from-black/50 to-transparent">
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            onClick={() => onBearbeiten(foto)}
            aria-label="Foto bearbeiten"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {kannLoeschen && (
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7"
              onClick={() => onLoeschen(foto)}
              aria-label="Foto löschen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Meta-Infos */}
      <div className="p-2.5 space-y-1">
        {foto.bildunterschrift ? (
          <p className="text-xs font-medium line-clamp-2 leading-tight">{foto.bildunterschrift}</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">Keine Bildunterschrift</p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span>{formatiereDatum(foto.erstellt_am)}</span>
          <span>·</span>
          <span className="truncate max-w-[120px]">{uploaderName(foto.uploader)}</span>
          {foto.begehung && (
            <>
              <span>·</span>
              <span>{formatiereDatum(foto.begehung.datum)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
