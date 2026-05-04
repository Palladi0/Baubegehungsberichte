export interface VorlageConfig {
  id: string
  name: string
  ist_standard: boolean
  logo_pfad: string | null
  logo_url?: string | null
  firmenname: string
  primaerfarbe: string
  sekundaerfarbe: string
  kopfzeilen_text: string
  fusszeilen_text: string
  schriftgroesse: 'klein' | 'mittel' | 'gross'
  erstellt_am: string
  geaendert_am: string
}

export interface VorlageSnapshot {
  name: string
  logo_pfad: string | null
  firmenname: string
  primaerfarbe: string
  sekundaerfarbe: string
  kopfzeilen_text: string
  fusszeilen_text: string
  schriftgroesse: 'klein' | 'mittel' | 'gross'
}

export interface FotoInBericht {
  foto_id: string
  thumb_url: string
  display_url: string
  bildunterschrift: string
  sichtbar: boolean
  reihenfolge: number
}

export interface AbschnittInBericht {
  begehungs_id: string
  titel: string
  freitext: string
  sichtbar: boolean
  reihenfolge: number
  fotos: FotoInBericht[]
}

export interface Deckblatt {
  firmenlogo_url: string | null
  projektname: string
  projektnummer: string
  datum: string
  uhrzeit: string
  wetter: string | null
  temperatur: number | null
  teilnehmer: { name: string; rolle: string }[]
  erstellt_am: string
  ersteller_name: string
}

export interface BerichtsSnapshot {
  deckblatt: Deckblatt
  abschnitte: AbschnittInBericht[]
  vorlage_snapshot?: VorlageSnapshot
}

export interface Bericht {
  id: string
  projekt_id: string
  projekt_name: string
  projekt_nummer: string
  ersteller_id: string
  ersteller_email: string
  begehungs_datum: string
  status: 'entwurf' | 'fertig'
  aktuelle_version_nr: number
  erstellt_am: string
  aktualisiert_am: string
  pdf_pfad: string | null
  pdf_generiert_am: string | null
  pdf_versions_nr: number | null
  vorlage_id: string | null
}

export interface BerichtListItem extends Bericht {
  foto_anzahl: number
}

export interface BerichteListResponse {
  berichte: BerichtListItem[]
  gesamt: number
  seiten: number
}

export interface BerichtsVersion {
  id: string
  bericht_id: string
  version_nr: number
  erstellt_am: string
  inhalt: BerichtsSnapshot
}

export interface BerichtMitVersion extends Bericht {
  aktuelle_version: BerichtsVersion | null
}
