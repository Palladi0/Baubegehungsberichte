'use client'

import Link from 'next/link'
import { FileText, Image } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { AktionenDropdown } from './AktionenDropdown'
import type { BerichtListItem } from '@/types/berichte'

interface BerichteTabellProps {
  berichte: BerichtListItem[]
  gesamt: number
  seiten: number
  aktuelleSeite: number
  laedt: boolean
  userId: string
  userRole: string
  istGefiltert: boolean
  onSeitenWechsel: (seite: number) => void
  onReload: () => void
}

function formatDatum(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' })
}

function StatusBadge({ status }: { status: 'entwurf' | 'fertig' }) {
  return status === 'fertig' ? (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200">
      Fertig
    </Badge>
  ) : (
    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200">
      Entwurf
    </Badge>
  )
}

function LadeZeilen() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

function LeerZustand({ istGefiltert }: { istGefiltert: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={7} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30" />
          {istGefiltert ? (
            <>
              <p className="text-sm font-medium">Keine Berichte für diese Filter</p>
              <p className="text-xs">Passe die Filter an oder setze sie zurück.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Noch keine Berichte</p>
              <p className="text-xs">Erstelle deinen ersten Bericht.</p>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function BerichteTabelle({
  berichte,
  gesamt,
  seiten,
  aktuelleSeite,
  laedt,
  userId,
  userRole,
  istGefiltert,
  onSeitenWechsel,
  onReload,
}: BerichteTabellProps) {
  return (
    <div className="space-y-4">
      {/* Zähler */}
      {!laedt && (
        <p className="text-sm text-muted-foreground">
          {gesamt === 0
            ? 'Keine Berichte gefunden'
            : `${gesamt} Bericht${gesamt !== 1 ? 'e' : ''} gefunden`}
        </p>
      )}

      {/* Tabelle */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="hidden md:table-cell">Ersteller</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">
                <span className="flex items-center gap-1">
                  <Image className="h-3.5 w-3.5" aria-hidden />
                  Fotos
                </span>
              </TableHead>
              <TableHead className="hidden lg:table-cell">Erstellt am</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Aktionen</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {laedt ? (
              <LadeZeilen />
            ) : berichte.length === 0 ? (
              <LeerZustand istGefiltert={istGefiltert} />
            ) : (
              berichte.map((b) => {
                const kannLöschen = userRole === 'admin' || b.ersteller_id === userId
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link
                        href={`/berichte/${b.id}`}
                        className="font-medium hover:underline"
                      >
                        {b.projekt_name}
                      </Link>
                      {b.projekt_nummer && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {b.projekt_nummer}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDatum(b.begehungs_datum)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {b.ersteller_email}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {b.foto_anzahl}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                      {formatDatum(b.erstellt_am)}
                    </TableCell>
                    <TableCell>
                      <AktionenDropdown
                        bericht={b}
                        kannLöschen={kannLöschen}
                        onGelöscht={onReload}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginierung */}
      {seiten > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {aktuelleSeite} von {seiten}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => onSeitenWechsel(aktuelleSeite - 1)}
                  aria-disabled={aktuelleSeite === 1}
                  className={aktuelleSeite === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>

              {/* Sliding window: show up to 5 pages centred on current page */}
              {(() => {
                const fenster = 2
                const start = Math.max(1, aktuelleSeite - fenster)
                const end = Math.min(seiten, aktuelleSeite + fenster)
                const nummern: number[] = []
                for (let n = start; n <= end; n++) nummern.push(n)
                return (
                  <>
                    {start > 1 && (
                      <>
                        <PaginationItem>
                          <Button variant="ghost" size="sm" className="h-9 w-9" onClick={() => onSeitenWechsel(1)}>1</Button>
                        </PaginationItem>
                        {start > 2 && <PaginationItem><span className="px-1 text-muted-foreground">…</span></PaginationItem>}
                      </>
                    )}
                    {nummern.map((n) => (
                      <PaginationItem key={n}>
                        <Button
                          variant={n === aktuelleSeite ? 'default' : 'ghost'}
                          size="sm"
                          className="h-9 w-9"
                          onClick={() => onSeitenWechsel(n)}
                        >
                          {n}
                        </Button>
                      </PaginationItem>
                    ))}
                    {end < seiten && (
                      <>
                        {end < seiten - 1 && <PaginationItem><span className="px-1 text-muted-foreground">…</span></PaginationItem>}
                        <PaginationItem>
                          <Button variant="ghost" size="sm" className="h-9 w-9" onClick={() => onSeitenWechsel(seiten)}>{seiten}</Button>
                        </PaginationItem>
                      </>
                    )}
                  </>
                )
              })()}

              <PaginationItem>
                <PaginationNext
                  onClick={() => onSeitenWechsel(aktuelleSeite + 1)}
                  aria-disabled={aktuelleSeite === seiten}
                  className={aktuelleSeite === seiten ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
