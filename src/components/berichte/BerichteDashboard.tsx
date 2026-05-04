'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterLeiste, type FilterZustand } from './FilterLeiste'
import { BerichteTabelle } from './BerichteTabelle'
import type { BerichteListResponse } from '@/types/berichte'

interface Projekt {
  id: string
  name: string
  kuerzel: string
}

interface BerichteDashboardProps {
  projekte: Projekt[]
  userId: string
  userRole: string
}

const STANDARD_FILTER: FilterZustand = {
  projekt_id: '',
  von: '',
  bis: '',
  status: '',
  suche: '',
  sortierung: 'datum_desc',
}

function buildUrl(filter: FilterZustand, seite: number): string {
  const params = new URLSearchParams()
  if (filter.projekt_id) params.set('projekt_id', filter.projekt_id)
  if (filter.von) params.set('von', filter.von)
  if (filter.bis) params.set('bis', filter.bis)
  if (filter.status) params.set('status', filter.status)
  if (filter.suche) params.set('suche', filter.suche)
  params.set('seite', String(seite))
  params.set('sortierung', filter.sortierung)
  return `/api/reports?${params.toString()}`
}

const fetcher = (url: string): Promise<BerichteListResponse> =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error('Fehler beim Laden der Berichte')
    return res.json()
  })

export function BerichteDashboard({ projekte, userId, userRole }: BerichteDashboardProps) {
  const [filter, setFilter] = useState<FilterZustand>(STANDARD_FILTER)
  const [seite, setSeite] = useState(1)

  const swrKey = buildUrl(filter, seite)
  const { data, isLoading, error, mutate } = useSWR<BerichteListResponse>(swrKey, fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  })

  const handleFilterChange = useCallback((neuerFilter: FilterZustand) => {
    setFilter(neuerFilter)
    setSeite(1)
  }, [])

  const handleZurücksetzen = useCallback(() => {
    setFilter(STANDARD_FILTER)
    setSeite(1)
  }, [])

  const handleReload = useCallback(() => {
    mutate()
  }, [mutate])

  const berichte = data?.berichte ?? []
  const gesamt = data?.gesamt ?? 0
  const seiten = data?.seiten ?? 0
  const istGefiltert =
    filter.projekt_id !== '' ||
    filter.von !== '' ||
    filter.bis !== '' ||
    filter.status !== '' ||
    filter.suche !== ''

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <FileText className="h-6 w-6" />
            Berichte
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Übersicht aller Baustellenbegehungsberichte
          </p>
        </div>
        <Button asChild>
          <Link href="/berichte/neu">
            <Plus className="mr-2 h-4 w-4" />
            Neuer Bericht
          </Link>
        </Button>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <FilterLeiste
          filter={filter}
          projekte={projekte}
          onChange={handleFilterChange}
          onZurücksetzen={handleZurücksetzen}
        />
      </div>

      {/* Fehlermeldung */}
      {error && !isLoading && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Berichte konnten nicht geladen werden. Bitte Seite neu laden.
        </div>
      )}

      {/* Tabelle */}
      <BerichteTabelle
        berichte={berichte}
        gesamt={gesamt}
        seiten={seiten}
        aktuelleSeite={seite}
        laedt={isLoading}
        userId={userId}
        userRole={userRole}
        istGefiltert={istGefiltert}
        onSeitenWechsel={setSeite}
        onReload={handleReload}
      />
    </main>
  )
}
