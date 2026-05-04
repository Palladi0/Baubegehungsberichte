export type ProjektEintrag = {
  id: string
  name: string
  nummer: string
  kuerzel: string
  auftraggeber: string | null
  bauherr: string | null
  adresse: string | null
  start_datum: string | null
  end_datum: string | null
  beschreibung: string | null
  archived_at: string | null
  erstellt_am: string
  aktualisiert_am: string
  mitarbeiter_anzahl?: number
}

export type ProjektMitarbeiter = {
  id: string
  email: string
  rolle: 'admin' | 'mitarbeiter'
  aktiv: boolean
  hinzugefuegt_am: string | null
}

export type NutzerOption = {
  id: string
  email: string
  rolle: 'admin' | 'mitarbeiter'
}
