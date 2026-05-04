export type Wetterbedingung = 'Sonnig' | 'Bewölkt' | 'Regnerisch' | 'Schnee' | 'Nebel'

export const WETTERBEDINGUNGEN: Wetterbedingung[] = [
  'Sonnig',
  'Bewölkt',
  'Regnerisch',
  'Schnee',
  'Nebel',
]

export type BegehungStatus = 'Entwurf' | 'Fertig'

export type Teilnehmer = {
  id: string
  name: string
  rolle: string
}

export type BegehungEintrag = {
  id: string
  projekt_id: string
  projekt_name: string
  projekt_kuerzel: string
  bearbeiter_id: string
  bearbeiter_email: string
  datum: string
  uhrzeit: string
  wetterbedingungen: Wetterbedingung | null
  temperatur: number | null
  leistungsstand: string | null
  vorkommnisse: string | null
  massnahmen: string | null
  bemerkungen: string | null
  status: BegehungStatus
  teilnehmer: Teilnehmer[]
  erstellt_am: string
  aktualisiert_am: string
}

export type BegehungFormData = {
  projekt_id: string
  datum: string
  uhrzeit: string
  wetterbedingungen: Wetterbedingung | ''
  temperatur: string
  leistungsstand: string
  vorkommnisse: string
  massnahmen: string
  bemerkungen: string
  status: BegehungStatus
  teilnehmer: Omit<Teilnehmer, 'id'>[]
}

export type KiExtraktionErgebnis = {
  teilnehmer?: { name: string; rolle: string }[]
  leistungsstand?: string
  vorkommnisse?: string
  massnahmen?: string
  bemerkungen?: string
}

export type WetterDaten = {
  wetterbedingungen: Wetterbedingung
  temperatur: number
}

export type ProjektOption = {
  id: string
  name: string
  kuerzel: string
  adresse: string | null
  lat: number | null
  lon: number | null
}
