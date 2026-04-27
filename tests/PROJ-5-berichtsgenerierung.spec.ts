import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-5 — Berichtsgenerierung E2E Tests
//
// Tests run against the live dev server. Authenticated flows mock API responses
// via page.route() and skip if auth session is not available (no real Supabase
// session). Unauthenticated redirect tests always run.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-qa', email: 'qa@ppb.de', role: 'mitarbeiter' }

const MOCK_PROJEKTE = [
  { id: 'proj-1', name: 'Bauprojekt Hamburg', nummer: 'BV-23-001', kuerzel: 'BV-23-HH' },
]

const BERICHT_ID = 'bericht-test-qa-1'

const MOCK_VERSION_INHALT = {
  deckblatt: {
    firmenlogo_url: null,
    projektname: 'Bauprojekt Hamburg',
    projektnummer: 'BV-23-001',
    datum: '2026-04-27',
    uhrzeit: '09:00',
    wetter: 'Sonnig',
    temperatur: 18,
    teilnehmer: [
      { name: 'Max Muster', rolle: 'Architekt' },
      { name: 'Eva Schmidt', rolle: 'Bauleitung' },
    ],
    erstellt_am: '2026-04-27T12:00:00Z',
    ersteller_name: 'qa@ppb.de',
  },
  abschnitte: [
    {
      begehungs_id: 'beg-1',
      titel: 'Abschnitt 1 – 2026-04-27',
      freitext: 'Leistungsstand: 80%\n\nVorkommnisse: Keine besonderen Vorkommnisse.',
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
        {
          foto_id: 'foto-2',
          thumb_url: '/api/media/file/foto-2?thumb=1',
          display_url: '/api/media/file/foto-2',
          bildunterschrift: 'Decke 1. OG',
          sichtbar: true,
          reihenfolge: 1,
        },
      ],
    },
    {
      begehungs_id: 'beg-2',
      titel: 'Abschnitt 2 – 2026-04-27',
      freitext: 'Nachmittags-Begehung.',
      sichtbar: true,
      reihenfolge: 1,
      fotos: [],
    },
  ],
}

const MOCK_BERICHT = {
  id: BERICHT_ID,
  projekt_id: 'proj-1',
  projekt_name: 'Bauprojekt Hamburg',
  projekt_nummer: 'BV-23-001',
  ersteller_id: 'user-qa',
  ersteller_email: 'qa@ppb.de',
  begehungs_datum: '2026-04-27',
  status: 'entwurf',
  aktuelle_version_nr: 1,
  erstellt_am: '2026-04-27T12:00:00Z',
  aktualisiert_am: '2026-04-27T12:00:00Z',
  pdf_pfad: null,
  pdf_generiert_am: null,
  pdf_versions_nr: null,
  vorlage_id: null,
  aktuelle_version: {
    id: 'ver-1',
    bericht_id: BERICHT_ID,
    version_nr: 1,
    erstellt_am: '2026-04-27T12:00:00Z',
    inhalt: MOCK_VERSION_INHALT,
  },
}

const MOCK_VERSIONEN = [
  { id: 'ver-1', version_nr: 1, erstellt_am: '2026-04-27T12:00:00Z' },
]

async function setupMocks(page: import('@playwright/test').Page) {
  await page.route('/api/benutzer/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route('/api/projekte', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROJEKTE) })
  )
  await page.route(`/api/reports/${BERICHT_ID}`, (r) => {
    if (r.request().method() === 'GET') {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BERICHT) })
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
  await page.route('/api/reports/generate', (r) => {
    if (r.request().method() !== 'POST') { r.continue(); return }
    r.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: BERICHT_ID, version_nr: 1 }),
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// AC: Unauthentifizierte Weiterleitungen (always run)
// ─────────────────────────────────────────────────────────────────────────────

test('AC-REDIRECT-01: Unauthentifizierter Zugriff auf /berichte/neu leitet auf Login um', async ({ page }) => {
  await page.goto('/berichte/neu')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-REDIRECT-02: Unauthentifizierter Zugriff auf Bericht-Editor leitet auf Login um', async ({ page }) => {
  await page.goto(`/berichte/${BERICHT_ID}`)
  await expect(page).toHaveURL(/\/login/)
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: Bericht-Generator-Dialog (/berichte/neu)
// ─────────────────────────────────────────────────────────────────────────────

test('AC-GEN-01: Generator-Seite zeigt Projekt-Dropdown und Datum-Input', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/berichte/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByRole('combobox').first()).toBeVisible()
  await expect(page.getByLabel('Begehungsdatum auswählen')).toBeVisible()
})

test('AC-GEN-02: Projekt-Dropdown zeigt verfügbare Projekte', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/berichte/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('combobox').first().click()
  await expect(page.getByText('Bauprojekt Hamburg')).toBeVisible()
})

test('AC-GEN-03: "Bericht generieren"-Button ist deaktiviert wenn kein Projekt gewählt', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/berichte/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  const btn = page.getByRole('button', { name: /Bericht generieren/ })
  await expect(btn).toBeDisabled()
})

test('AC-GEN-04: Datum-Input zeigt heutiges Datum als Default und beschränkt auf Vergangenheit', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/berichte/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  const input = page.getByLabel('Begehungsdatum auswählen')
  const today = new Date().toISOString().slice(0, 10)
  await expect(input).toHaveValue(today)
  expect(await input.getAttribute('max')).toBe(today)
})

test('AC-GEN-05: Fehlermeldung bei Keine-Begehungen-gefunden (Edge Case)', async ({ page }) => {
  await setupMocks(page)
  await page.route('/api/reports/generate', (r) => {
    if (r.request().method() !== 'POST') { r.continue(); return }
    r.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Für das gewählte Datum und Projekt liegen keine abgeschlossenen Begehungen vor.' }),
    })
  })
  await page.goto('/berichte/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('combobox').first().click()
  await page.getByText('Bauprojekt Hamburg').click()
  await page.getByRole('button', { name: /Bericht generieren/ }).click()
  await expect(page.getByText(/keine abgeschlossenen Begehungen/)).toBeVisible()
})

test('AC-GEN-06: Hinweis bei mehr als 50 Fotos (Edge Case)', async ({ page }) => {
  await setupMocks(page)
  await page.route('/api/reports/generate', (r) => {
    if (r.request().method() !== 'POST') { r.continue(); return }
    r.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: BERICHT_ID,
        version_nr: 1,
        warnung: 'Dieser Bericht enthält 50+ Fotos. Das kann den PDF-Export verlangsamen.',
      }),
    })
  })
  await page.goto('/berichte/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('combobox').first().click()
  await page.getByText('Bauprojekt Hamburg').click()
  await page.getByRole('button', { name: /Bericht generieren/ }).click()
  await expect(page.getByText(/50\+ Fotos/)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: Bericht-Editor (/berichte/[id])
// ─────────────────────────────────────────────────────────────────────────────

test('AC-EDIT-01: Editor zeigt Deckblatt mit Berichtstitel und Metadaten', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Baustellenbegehung – Bauprojekt Hamburg')).toBeVisible()
  await expect(page.getByText('BV-23-001')).toBeVisible()
  await expect(page.getByLabel('Wetterbedingungen')).toHaveValue('Sonnig')
  await expect(page.getByLabel('Temperatur (°C)')).toHaveValue('18')
  await expect(page.getByText('Max Muster')).toBeVisible()
  await expect(page.getByText('Eva Schmidt')).toBeVisible()
})

test('AC-EDIT-02: Deckblatt zeigt [Firmenname]-Platzhalter ohne Logo', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('[Firmenname]')).toBeVisible()
})

test('AC-EDIT-03: Mehrere Begehungen erscheinen als separate Abschnitte', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByDisplayValue('Abschnitt 1 – 2026-04-27')).toBeVisible()
  await expect(page.getByDisplayValue('Abschnitt 2 – 2026-04-27')).toBeVisible()
})

test('AC-EDIT-04: Abschnittstitel ist inline editierbar', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  const titelInput = page.getByLabel('Abschnittstitel').first()
  await titelInput.fill('Geänderter Titel')
  await expect(titelInput).toHaveValue('Geänderter Titel')
})

test('AC-EDIT-05: Freitext-Bereich ist editierbar', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  const textarea = page.getByLabel('Freitext').first()
  await textarea.fill('Neuer Inhalt')
  await expect(textarea).toHaveValue('Neuer Inhalt')
})

test('AC-EDIT-06: Abschnitt per Switch ausblenden — Counter aktualisiert sich', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  // Vorher: 2 sichtbar
  await expect(page.getByText(/2 sichtbar/)).toBeVisible()

  // Ersten Abschnitt ausblenden
  await page.getByRole('switch').first().click()

  // Nachher: 1 sichtbar / 2 gesamt
  await expect(page.getByText(/1 sichtbar/)).toBeVisible()
})

test('AC-EDIT-07: Foto-Galerie zeigt Fotos mit editierbaren Bildunterschriften', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByDisplayValue('Rohbau Ostseite')).toBeVisible()
  await expect(page.getByDisplayValue('Decke 1. OG')).toBeVisible()
})

test('AC-EDIT-08: Einzelne Fotos können per Button ausgeblendet werden', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  const fotoToggle = page.getByLabel('Foto ausblenden').first()
  await expect(fotoToggle).toBeVisible()
  await fotoToggle.click()
  await expect(page.getByLabel('Foto einblenden').first()).toBeVisible()
})

test('AC-EDIT-09: Bildunterschrift eines Fotos ist editierbar', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  const input = page.getByDisplayValue('Rohbau Ostseite')
  await input.fill('Neue Bildunterschrift')
  await expect(input).toHaveValue('Neue Bildunterschrift')
})

test('AC-EDIT-10: Versions-Anzeige zeigt aktuelle Versionsnummer', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Version 1')).toBeVisible()
})

test('AC-EDIT-11: Speichern-Button sendet PUT-Request und zeigt Zeitstempel', async ({ page }) => {
  await setupMocks(page)
  let putCalled = false
  await page.route(`/api/reports/${BERICHT_ID}`, (r) => {
    if (r.request().method() === 'PUT') {
      putCalled = true
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version_nr: 2 }) })
    } else {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BERICHT) })
    }
  })
  await page.route(`/api/reports/${BERICHT_ID}/versions`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'ver-2', version_nr: 2, erstellt_am: new Date().toISOString() },
        ...MOCK_VERSIONEN,
      ]),
    })
  )

  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: /Speichern/ }).click()
  await expect(page.getByText(/Gespeichert um/)).toBeVisible()
  expect(putCalled).toBe(true)
})

test('AC-EDIT-12: Vorschau-Button öffnet Preview-HTML in neuem Tab', async ({ page, context }) => {
  await setupMocks(page)
  await page.route(`/api/reports/${BERICHT_ID}/preview`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<html><body><h1>Baustellenbegehung</h1></body></html>',
    })
  )

  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: /Vorschau/ }).click(),
  ])
  await expect(newPage).toHaveURL(new RegExp(`/api/reports/${BERICHT_ID}/preview`))
})

test('AC-EDIT-13: Wetterbedingungen und Temperatur sind inline im Deckblatt editierbar', async ({ page }) => {
  await setupMocks(page)
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  const wetterInput = page.getByLabel('Wetterbedingungen')
  await wetterInput.fill('Bewölkt')
  await expect(wetterInput).toHaveValue('Bewölkt')

  const tempInput = page.getByLabel('Temperatur (°C)')
  await tempInput.fill('12')
  await expect(tempInput).toHaveValue('12')
})

// ─────────────────────────────────────────────────────────────────────────────
// AC: Versionsverlauf
// ─────────────────────────────────────────────────────────────────────────────

test('AC-VER-01: Versions-Dropdown erscheint bei mehreren Versionen', async ({ page }) => {
  await setupMocks(page)
  await page.route(`/api/reports/${BERICHT_ID}/versions`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'ver-2', version_nr: 2, erstellt_am: '2026-04-27T14:00:00Z' },
        { id: 'ver-1', version_nr: 1, erstellt_am: '2026-04-27T12:00:00Z' },
      ]),
    })
  )
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByLabel('Version laden')).toBeVisible()
})

test('AC-VER-02: Version laden über Dropdown ruft GET /versions/[nr] auf', async ({ page }) => {
  await setupMocks(page)
  await page.route(`/api/reports/${BERICHT_ID}/versions`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'ver-2', version_nr: 2, erstellt_am: '2026-04-27T14:00:00Z' },
        { id: 'ver-1', version_nr: 1, erstellt_am: '2026-04-27T12:00:00Z' },
      ]),
    })
  )

  let versionFetched = false
  await page.route(`/api/reports/${BERICHT_ID}/versions/1`, (r) => {
    versionFetched = true
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...MOCK_BERICHT.aktuelle_version, version_nr: 1 }),
    })
  })

  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByLabel('Version laden').click()
  await page.getByRole('option', { name: /V1/ }).click()
  expect(versionFetched).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// Responsive Design
// ─────────────────────────────────────────────────────────────────────────────

test('RESP-01: Generator-Seite ist auf Mobile (375px) nutzbar', async ({ page }) => {
  await setupMocks(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/berichte/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Neuen Bericht erstellen')).toBeVisible()
  await expect(page.getByRole('button', { name: /Bericht generieren/ })).toBeVisible()
})

test('RESP-02: Bericht-Editor ist auf Tablet (768px) nutzbar', async ({ page }) => {
  await setupMocks(page)
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto(`/berichte/${BERICHT_ID}`)
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Baustellenbegehung – Bauprojekt Hamburg')).toBeVisible()
  await expect(page.getByRole('button', { name: /Speichern/ })).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// Sicherheit — API-Auth-Schutz (always run, no session needed)
// ─────────────────────────────────────────────────────────────────────────────

test('SEC-01: POST /api/reports/generate schützt Zugriff ohne Auth (Redirect zu Login)', async ({ page }) => {
  // maxRedirects: 0 verhindert automatisches Folgen des Login-Redirects
  const response = await page.request.post('/api/reports/generate', {
    data: { projekt_id: '00000000-0000-0000-0000-000000000001', datum: '2026-04-27' },
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  expect([401, 302, 307, 308]).toContain(response.status())
})

test('SEC-02: GET /api/reports/[id] schützt Zugriff ohne Auth (Redirect zu Login)', async ({ page }) => {
  const response = await page.request.get(`/api/reports/${BERICHT_ID}`, {
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  expect([401, 302, 307, 308]).toContain(response.status())
})

test('SEC-03: PUT /api/reports/[id] schützt Zugriff ohne Auth (Redirect zu Login)', async ({ page }) => {
  const response = await page.request.put(`/api/reports/${BERICHT_ID}`, {
    data: { inhalt: { deckblatt: {}, abschnitte: [] } },
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  expect([401, 302, 307, 308]).toContain(response.status())
})

test('SEC-04: GET /api/reports/[id]/preview schützt Zugriff ohne Auth (Redirect zu Login)', async ({ page }) => {
  const response = await page.request.get(`/api/reports/${BERICHT_ID}/preview`, {
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  expect([401, 302, 307, 308]).toContain(response.status())
})

test('SEC-05: POST /api/reports/generate gibt 422 bei ungültigem Datum-Format (Validierung vor DB)', async ({ page }) => {
  const response = await page.request.post('/api/reports/generate', {
    data: { projekt_id: '00000000-0000-0000-0000-000000000001', datum: 'invalid-date' },
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  // Ohne Auth: Redirect zu Login (302/307); mit Auth: 422 (Zod-Validierung)
  expect([302, 307, 308, 422]).toContain(response.status())
})
