export type Foto = {
  id: string
  projekt_id: string
  begehung_id: string | null
  uploader_id: string
  original_dateiname: string
  datei_endung: string
  dateigroesse_original: number
  bildunterschrift: string | null
  erstellt_am: string
  aktualisiert_am: string
  uploader: { id: string; vorname: string | null; nachname: string | null; email: string } | null
  begehung: { id: string; datum: string; uhrzeit: string } | null
}

export type Begehung = {
  id: string
  datum: string
  uhrzeit: string
}
