import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-6 — PDF-Export E2E Tests
//
// Tests run against the live dev server. Authenticated flows mock API responses
// via page.route() and skip if auth session is not available (no real Supabase
// session). Unauthenticated redirect tests always run.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-qa', email: 'qa@ppb.de', role: 'mitarbeiter' }

const BERICHT_ID = 'bericht-pdf-qa-1'

const MOCK_VERSION_INHALT = {
  deckblatt: {
    firmenlogo_url: null,
    projektname: 'Bauprojekt Hamburg',
    projektnummer: 'BV-23-001',
    datum: '2026-04-27',
    uhrzeit: '09:00',
    wetter: 'Sonnig',
    temperatur: 18,
    teilnehmer: [{ name: 'Max Muster', rolle: 'Architekt' }],
    erstellt_am: '2026-04-27T12:00:00Z',
    ersteller_name: 'qa@ppb.de',
  },
  abschnitte: [
    {
      begehungs_id: 'beg-1',
      titel: 'Abschnitt 1 – 2026-04-27',
      freitext: 'Leistungsstand: 80%',
      sichtbar: true,
      reihenfolge: 0,
      fotos: [
        {
          foto_id: 'foto-1',
          thumb_url: '/api/media/file/foto-1?thumb=1',
          display_url: '/api/media/file/foto-1',
          bildunterschrift: 'Rohbau Ostseite',
          sichtbar: true,
          reihenfolge: 0,
        },
      ],
    },
  ],
}

const MOCK_BERICHT_OHNE_PDF = {
  id: BERICHT_ID,
  projekt_id: 'proj-1',
  projekt_name: 'Bauprojekt Hamburg',
  projekt_nummer: 'BV-23-001',
  ersteller_id: 'user-qa',
  ersteller_email: 'qa@ppb.de',
  begehungs_datum: '2026-04-27',
  status: 'entwurf' as const,
  aktuelle_version_nr: 2,
  erstellt_am: '2026-04-27T12:00:00Z',
  aktualisiert_am: '2026-04-27T12:00:00Z',
  pdf_pfad: null,
  pdf_generiert_am: null,
  pdf_versions_nr: null,
  vorlage_id: null,
  aktuelle_version: {
    id: 'ver-1',
    bericht_id: BERICHT_ID,
    version_nr: 2,
    erstellt_am: '2026-04-27T12:00:00Z',
    inhalt: MOCK_VERSION_INHALT,
  },
}

const MOCK_BERICHT_MIT_PDF = {
  ...MOCK_BERICHT_OHNE_PDF,
  pdf_pfad: '/var/reports/pdf/bericht-pdf-qa-1.pdf',
  pdf_generiert_am: '2026-04-27T13:00:00Z',
  pdf_versions_nr: 2,
}

const MOCK_BERICHT_PDF_VERALTET = {
  ...MOCK_BERICHT_OHNE_PDF,
  aktuelle_version_nr: 3,
  pdf_pfad: '/var/reports/pdf/bericht-pdf-qa-1.pdf',
  pdf_generiert_am: '2026-04-27T13:00:00Z',
  pdf_versions_nr: 2,
}

const MOCK_VERSIONEN = [
  { id: 'ver-1', version_nr: 2, erstellt_am: '2026-04-27T12:00:00Z' },
]

const MOCK_BERICHTE_LISTE = {
  berichte: [
    {
      id: BERICHT_ID,
      projekt_id: 'proj-1',
      projekt_name: 'Bauprojekt Hamburg',
      projekt_nummer: 'BV-23-001',
      ersteller_id: 'user-qa',
      ersteller_email: 'qa@ppb.de',
      begehungs_datum: '2026-04-27',
      status: 'entwurf',
      aktuelle_version_nr: 2,
      erstellt_am: '2026-04-27T12:00:00Z',
      aktualisiert_am: '2026-04-27T12:00:00Z',
      pdf_pfad: null,
      pdf_generiert_am: null,
      pdf_versions_nr: null,
      vorlage_id: null,
      foto_anzahl: 1,
    },
  ],
  gesamt: 1,
  seiten: 1,
}

async function setupEditorMocks(
  page: import('@playwright/test').Page,
  bericht = MOCK_BERICHT_OHNE_PDF
) {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route('/api/projekte', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route(`/api/reports/${BERICHT_ID}`, (r) => {
    if (r.request().method() === 'GET') {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bericht) })
    } else {
      r.continue()
    }
  })
  await page.route(`/api/reports/${BERICHT_ID}/versions`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VERSIONEN) })
  )
  await page.route('/api/templates', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
}

async function setupDashboardMocks(
  page: import('@playwright/test').Page,
  hatPdf = false
) {
  const berichte = {
    ...MOCK_BERICHTE_LISTE,
    berichte: [
      {
        ...MOCK_BERICHTE_LISTE.berichte[0],
        pdf_pfad: hatPdf ? '/uploads/pdf/bericht-pdf-qa-1.pdf' : null,
      },
    ],
  }
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route('/api/reports**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(berichte) })
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AC: Unauthentifizierte Weiterleitungen (always run)
// ─────────────────────────────────────────────────────────────────────────────

test('AC-AUTH-01: Unauthentifizierter Zugriff auf Bericht-Editor leitet auf Login um', async ({ page }) => {
  await page.goto(`/berichte/${BERICHT_ID}`)
  await expect(page).toHaveURL(/\/login/)
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: PDF-Export-Button sichtbar (Editor)
// ─────────────────────────────────────────────────────────────────────────────

test('AC-BTN-01: PDF-Export-Button ist im Bericht-Editor sichtbar', async ({ page }) => {
  await setupEditorMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByRole('button', { name: /PDF exportieren/i })).toBeVisible()
})

test('AC-BTN-02: PDF-Export-Button zeigt Amber-Indikator wenn PDF veraltet ist', async ({ page }) => {
  await setupEditorMocks(page, MOCK_BERICHT_PDF_VERALTET)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  // Amber dot should be visible (title="PDF veraltet")
  const btn = page.getByRole('button', { name: /PDF exportieren/i })
  await expect(btn).toBeVisible()
  const dot = btn.locator('[title="PDF veraltet"]')
  await expect(dot).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: PDF-Export-Dialog
// ─────────────────────────────────────────────────────────────────────────────

test('AC-DIALOG-01: Klick auf PDF-Export-Button öffnet Dialog', async ({ page }) => {
  await setupEditorMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText(/PDF exportieren/i)).toBeVisible()
})

test('AC-DIALOG-02: Dialog zeigt Projektname und Begehungsdatum', async ({ page }) => {
  await setupEditorMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await expect(page.getByText(/BV-23-001/)).toBeVisible()
  await expect(page.getByText(/27\. April 2026/)).toBeVisible()
})

test('AC-DIALOG-03: Dialog zeigt "PDF generieren"-Button wenn kein PDF vorhanden', async ({ page }) => {
  await setupEditorMocks(page, MOCK_BERICHT_OHNE_PDF)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await expect(page.getByRole('button', { name: /PDF generieren/i })).toBeVisible()
})

test('AC-DIALOG-04: Dialog zeigt "Neu generieren"-Button wenn PDF vorhanden', async ({ page }) => {
  await setupEditorMocks(page, MOCK_BERICHT_MIT_PDF)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await expect(page.getByRole('button', { name: /Neu generieren/i })).toBeVisible()
})

test('AC-DIALOG-05: Dialog zeigt Hinweis auf vorhandenes PDF (Version)', async ({ page }) => {
  await setupEditorMocks(page, MOCK_BERICHT_MIT_PDF)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await expect(page.getByText(/Version 2/)).toBeVisible()
})

test('AC-DIALOG-06: Dialog zeigt Veraltet-Warnung wenn PDF-Version älter als aktuelle Version', async ({ page }) => {
  await setupEditorMocks(page, MOCK_BERICHT_PDF_VERALTET)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  // Alert should show "basiert auf Version 2. Die aktuelle Version ist 3"
  await expect(page.getByText(/basiert auf Version 2/)).toBeVisible()
  await expect(page.getByText(/Version.*3/)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: Fortschrittsanzeige während der Generierung
// ─────────────────────────────────────────────────────────────────────────────

test('AC-PROGRESS-01: Fortschrittsbalken wird während der PDF-Generierung angezeigt', async ({ page }) => {
  await setupEditorMocks(page)

  // Simuliere verzögerte API-Antwort (500ms)
  await page.route(`/api/reports/${BERICHT_ID}/export`, async (r) => {
    await new Promise((res) => setTimeout(res, 500))
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        dateiname: 'BV-23-001_Begehung_2026-04-27.pdf',
        version_nr: 2,
        foto_anzahl: 1,
        vorlage_name: null,
        warnung: null,
      }),
    })
  })

  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await page.getByRole('button', { name: /PDF generieren/i }).click()

  // Ladeindikator sollte sichtbar sein
  await expect(page.getByText(/PDF wird erstellt/i)).toBeVisible()
  await expect(page.locator('[role="progressbar"]')).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: Erfolg-Zustand nach Generierung
// ─────────────────────────────────────────────────────────────────────────────

test('AC-SUCCESS-01: Dialog zeigt Erfolg-Zustand und Download-Button nach Generierung', async ({ page }) => {
  await setupEditorMocks(page)

  await page.route(`/api/reports/${BERICHT_ID}/export`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        dateiname: 'BV-23-001_Begehung_2026-04-27.pdf',
        version_nr: 2,
        foto_anzahl: 1,
        vorlage_name: null,
        warnung: null,
      }),
    })
  )

  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await page.getByRole('button', { name: /PDF generieren/i }).click()

  await expect(page.getByText(/erfolgreich erstellt/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /BV-23-001_Begehung_2026-04-27\.pdf/i })).toBeVisible()
})

test('AC-SUCCESS-02: Dateiname folgt dem Schema [Projektkuerzel]_Begehung_[YYYY-MM-DD].pdf', async ({ page }) => {
  await setupEditorMocks(page)

  await page.route(`/api/reports/${BERICHT_ID}/export`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        dateiname: 'BV-23-001_Begehung_2026-04-27.pdf',
        version_nr: 2,
        foto_anzahl: 1,
        vorlage_name: null,
        warnung: null,
      }),
    })
  )

  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await page.getByRole('button', { name: /PDF generieren/i }).click()

  await expect(page.getByText(/BV-23-001_Begehung_2026-04-27\.pdf/i)).toBeVisible({ timeout: 10000 })
})

test('AC-SUCCESS-03: Warnung für > 100 Fotos wird nach Export angezeigt', async ({ page }) => {
  await setupEditorMocks(page)

  await page.route(`/api/reports/${BERICHT_ID}/export`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        dateiname: 'BV-23-001_Begehung_2026-04-27.pdf',
        version_nr: 2,
        foto_anzahl: 105,
        vorlage_name: null,
        warnung: 'Bericht enthält 105 Fotos — Export kann länger dauern.',
      }),
    })
  )

  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await page.getByRole('button', { name: /PDF generieren/i }).click()

  await expect(page.getByText(/105 Fotos/i)).toBeVisible({ timeout: 10000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: Fehler-Zustand
// ─────────────────────────────────────────────────────────────────────────────

test('AC-ERROR-01: Dialog zeigt Fehlermeldung wenn PDF-Generierung fehlschlägt', async ({ page }) => {
  await setupEditorMocks(page)

  await page.route(`/api/reports/${BERICHT_ID}/export`, (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'PDF-Generierung fehlgeschlagen. Bitte erneut versuchen.' }),
    })
  )

  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await page.getByRole('button', { name: /PDF generieren/i }).click()

  await expect(page.getByText(/PDF-Generierung fehlgeschlagen/i)).toBeVisible({ timeout: 10000 })
})

test('AC-ERROR-02: "Erneut versuchen"-Button erscheint im Fehlerfall', async ({ page }) => {
  await setupEditorMocks(page)

  await page.route(`/api/reports/${BERICHT_ID}/export`, (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'PDF-Generierung fehlgeschlagen. Bitte erneut versuchen.' }),
    })
  )

  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await page.getByRole('button', { name: /PDF generieren/i }).click()

  await expect(page.getByRole('button', { name: /Erneut versuchen/i })).toBeVisible({ timeout: 10000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: Dashboard — PDF herunterladen (PROJ-7 Integration)
// ─────────────────────────────────────────────────────────────────────────────

test('AC-DASHBOARD-01: "PDF herunterladen" ist im Aktionen-Dropdown sichtbar', async ({ page }) => {
  await setupDashboardMocks(page, false)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  // Aktionen-Dropdown öffnen
  const aktionenBtn = page.getByRole('button', { name: /Aktionen/i }).first()
  await expect(aktionenBtn).toBeVisible()
  await aktionenBtn.click()

  await expect(page.getByText(/PDF herunterladen/i)).toBeVisible()
})

test('AC-DASHBOARD-02: "PDF herunterladen" ist deaktiviert wenn kein PDF vorhanden', async ({ page }) => {
  await setupDashboardMocks(page, false)
  await page.goto('/berichte')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /Aktionen/i }).first().click()

  const pdfItem = page.getByText(/PDF herunterladen/i)
  await expect(pdfItem).toBeVisible()
  // Disabled item should have aria-disabled or pointer-events-none
  const menuItem = pdfItem.locator('..')
  await expect(menuItem).toHaveAttribute('data-disabled', 'true')
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: Responsive — Mobile (375px)
// ─────────────────────────────────────────────────────────────────────────────

test('AC-RESPONSIVE-01: PDF-Export-Button sichtbar auf Mobile (375px)', async ({ page }) => {
  await setupEditorMocks(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByRole('button', { name: /PDF exportieren/i })).toBeVisible()
})

test('AC-RESPONSIVE-02: PDF-Export-Dialog funktioniert auf Tablet (768px)', async ({ page }) => {
  await setupEditorMocks(page)
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /PDF exportieren/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
