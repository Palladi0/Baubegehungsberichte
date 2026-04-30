import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// PROJ-12 — Erweiterte Berichtsvorlagen E2E Tests
//
// Tests run against the live dev server. Authenticated admin pages have
// server-side auth guards (redirect to /login when no real Supabase session).
// Tests skip automatically when there is no real auth session; only
// unauthenticated redirect tests always run.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ADMIN = { id: 'admin-uuid', email: 'admin@ppb.de', role: 'admin' }
const MOCK_USER = { id: 'user-uuid', email: 'user@ppb.de', role: 'mitarbeiter' }

const MOCK_VORLAGEN = [
  {
    id: '00000000-0000-0000-0001-000000000001',
    name: 'Professionell',
    ist_standard: true,
    logo_pfad: null,
    logo_url: null,
    firmenname: '',
    primaerfarbe: '#1a1a1a',
    sekundaerfarbe: '#374151',
    kopfzeilen_text: 'Baustellenbegehungsbericht',
    fusszeilen_text: 'Vertraulich – Nur für den internen Gebrauch',
    schriftgroesse: 'mittel',
    erstellt_am: '2026-04-24T10:00:00Z',
    geaendert_am: '2026-04-24T10:00:00Z',
  },
  {
    id: '00000000-0000-0000-0001-000000000002',
    name: 'Modern',
    ist_standard: false,
    logo_pfad: null,
    logo_url: null,
    firmenname: '',
    primaerfarbe: '#1e40af',
    sekundaerfarbe: '#7c3aed',
    kopfzeilen_text: 'Baustellenbegehungsbericht',
    fusszeilen_text: 'Erstellt mit Baubegehungsberichte',
    schriftgroesse: 'mittel',
    erstellt_am: '2026-04-24T10:00:00Z',
    geaendert_am: '2026-04-24T10:00:00Z',
  },
]

async function setupAdminVorlagenMocks(page: import('@playwright/test').Page) {
  await page.route('/api/templates', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VORLAGEN) })
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Unauthentifizierte Weiterleitungen (always run)
// ─────────────────────────────────────────────────────────────────────────────

test('AC-AUTH-1: /admin/vorlagen ohne Session leitet auf /login weiter', async ({ page }) => {
  await page.goto('/admin/vorlagen')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-AUTH-2: /admin/vorlagen/neu ohne Session leitet auf /login weiter', async ({ page }) => {
  await page.goto('/admin/vorlagen/neu')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-AUTH-3: /admin/vorlagen/[id]/bearbeiten ohne Session leitet auf /login weiter', async ({ page }) => {
  await page.goto('/admin/vorlagen/00000000-0000-0000-0001-000000000001/bearbeiten')
  await expect(page).toHaveURL(/\/login/)
})

// ─────────────────────────────────────────────────────────────────────────────
// AC-1: Admin-Bereich Template-Verwaltung
// ─────────────────────────────────────────────────────────────────────────────

test('AC-1a: Vorlagenliste zeigt Template-Karten mit Namen und Standard-Badge', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Professionell')).toBeVisible()
  await expect(page.getByText('Modern')).toBeVisible()
  await expect(page.getByText('Standard')).toBeVisible()
})

test('AC-1b: Neue-Vorlage-Button öffnet /admin/vorlagen/neu', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: 'Neue Vorlage' }).click()
  await expect(page).toHaveURL(/\/admin\/vorlagen\/neu/)
})

test('AC-1c: Bearbeiten-Button öffnet Editor-Seite', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.route('/api/templates/00000000-0000-0000-0001-000000000001', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VORLAGEN[0]) })
  )
  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: 'Bearbeiten' }).first().click()
  await expect(page).toHaveURL(/\/bearbeiten$/)
})

test('AC-1d: Löschen-Button für Standard-Template ist deaktiviert', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  // Open dropdown for first card (Professionell = standard)
  const moreButtons = page.getByRole('button', { name: 'Aktionen' })
  await moreButtons.first().click()

  const loeschenItem = page.getByRole('menuitem', { name: 'Löschen' })
  await expect(loeschenItem).toBeDisabled()
})

test('AC-1e: Löschen eines nicht-Standard-Templates öffnet Bestätigungs-Dialog', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  // Open dropdown for second card (Modern = not standard)
  const moreButtons = page.getByRole('button', { name: 'Aktionen' })
  await moreButtons.nth(1).click()

  await page.getByRole('menuitem', { name: 'Löschen' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(page.getByText('Vorlage löschen?')).toBeVisible()
})

test('AC-1f: Als Standard markieren ruft PUT /api/templates/[id]/default auf', async ({ page }) => {
  await setupAdminVorlagenMocks(page)

  let defaultCalled = false
  await page.route('**/api/templates/**/default', (r) => {
    defaultCalled = true
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  // Open dropdown for "Modern" (non-standard)
  const moreButtons = page.getByRole('button', { name: 'Aktionen' })
  await moreButtons.nth(1).click()

  await page.getByRole('menuitem', { name: 'Als Standard markieren' }).click()
  await page.waitForTimeout(300)
  expect(defaultCalled).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// AC-2: Konfigurierbare Elemente im Editor-Formular
// ─────────────────────────────────────────────────────────────────────────────

test('AC-2a: Neues-Template-Formular zeigt alle Pflichtfelder', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByLabel('Name *')).toBeVisible()
  await expect(page.getByLabel('Firmenname (Fallback ohne Logo)')).toBeVisible()
  await expect(page.getByLabel('Primärfarbe (HEX)')).toBeVisible()
  await expect(page.getByLabel('Sekundärfarbe (HEX)')).toBeVisible()
  await expect(page.getByLabel('Kopfzeilen-Text')).toBeVisible()
  await expect(page.getByLabel('Fußzeilen-Text')).toBeVisible()
})

test('AC-2b: Schriftgröße-RadioGroup zeigt klein/mittel/groß Optionen', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByLabel('Klein (10pt)')).toBeVisible()
  await expect(page.getByLabel('Mittel (11pt)')).toBeVisible()
  await expect(page.getByLabel('Groß (13pt)')).toBeVisible()
})

test('AC-2c: Logo-Upload-Bereich ist sichtbar (PNG/SVG/JPEG/WEBP, max 2 MB)', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText(/PNG.*SVG.*JPEG.*WEBP.*max.*2 MB/)).toBeVisible()
})

test('AC-2d: Speichern ohne Name zeigt Fehler-Alert', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByRole('button', { name: 'Vorlage erstellen' }).click()
  await expect(page.getByText('Name ist erforderlich')).toBeVisible()
})

test('AC-2e: Ungültiger HEX-Farbwert zeigt Fehler-Alert', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await page.getByLabel('Name *').fill('Test')
  await page.getByLabel('Primärfarbe (HEX)').fill('rot')
  await page.getByRole('button', { name: 'Vorlage erstellen' }).click()
  await expect(page.getByText('Ungültige HEX-Farbwerte')).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// AC-3: Live-Vorschau
// ─────────────────────────────────────────────────────────────────────────────

test('AC-3: Live-Vorschau-iframe und Hinweistext sind sichtbar im Editor', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.locator('iframe[title="Vorlage-Vorschau"]')).toBeVisible()
  await expect(page.getByText('Live-Vorschau')).toBeVisible()
  await expect(page.getByText('wird live aktualisiert')).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// AC-4: Standard-Template ist als Standard markiert
// ─────────────────────────────────────────────────────────────────────────────

test('AC-4: Standard-Template zeigt Standard-Badge, kein Als-Standard-Menüeintrag sichtbar', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  // Badge visible
  await expect(page.getByText('Standard')).toBeVisible()

  // Open first card dropdown (standard template)
  await page.getByRole('button', { name: 'Aktionen' }).first().click()
  // "Als Standard markieren" should NOT appear for already-standard template
  await expect(page.getByRole('menuitem', { name: 'Als Standard markieren' })).not.toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// AC-5: Template-Wechsel im Bericht-Editor
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_BERICHT = {
  id: 'bericht-qa',
  projekt_id: 'proj-1',
  projekt_name: 'Testprojekt',
  projekt_nummer: 'TP-001',
  ersteller_id: 'user-uuid',
  ersteller_email: 'user@ppb.de',
  begehungs_datum: '2026-04-27',
  status: 'entwurf',
  aktuelle_version_nr: 1,
  erstellt_am: '2026-04-27T09:00:00Z',
  aktualisiert_am: '2026-04-27T09:00:00Z',
  pdf_pfad: null,
  pdf_generiert_am: null,
  pdf_versions_nr: null,
  vorlage_id: null,
  aktuelle_version: {
    id: 'ver-1',
    bericht_id: 'bericht-qa',
    version_nr: 1,
    erstellt_am: '2026-04-27T09:00:00Z',
    inhalt: {
      deckblatt: {
        firmenlogo_url: null,
        projektname: 'Testprojekt',
        projektnummer: 'TP-001',
        datum: '2026-04-27',
        uhrzeit: '10:00',
        wetter: null,
        temperatur: null,
        teilnehmer: [],
        erstellt_am: '2026-04-27T09:00:00Z',
        ersteller_name: 'user@ppb.de',
      },
      abschnitte: [],
    },
  },
}

test('AC-5a: Vorlage-Auswahl-Dropdown ist im Bericht-Editor sichtbar', async ({ page }) => {
  await page.route('/api/templates', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VORLAGEN) })
  )
  await page.route('**/api/reports/bericht-qa', (r) => {
    if (r.request().method() === 'GET') {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BERICHT) })
    } else {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }
  })
  await page.route('**/api/reports/bericht-qa/preview', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Vorschau</body></html>' })
  )
  await page.route('/api/projekte**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('/api/begehungen**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )

  await page.goto('/berichte/bericht-qa')
  if (page.url().includes('/login')) { test.skip(); return }

  // VorlageAuswahl component renders "Vorlage:" label
  await expect(page.getByText('Vorlage:')).toBeVisible()
})

test('AC-5b: Template-Wechsel ruft PATCH /api/reports/[id] auf (kein PUT)', async ({ page }) => {
  await page.route('/api/templates', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VORLAGEN) })
  )

  let patchCalled = false
  let putCalled = false

  await page.route('**/api/reports/bericht-qa', async (r) => {
    const method = r.request().method()
    if (method === 'PATCH') {
      patchCalled = true
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    } else if (method === 'PUT') {
      putCalled = true
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version_nr: 2 }) })
    } else {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BERICHT) })
    }
  })

  await page.route('**/api/reports/bericht-qa/preview', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Vorschau</body></html>' })
  )
  await page.route('/api/projekte**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('/api/begehungen**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )

  await page.goto('/berichte/bericht-qa')
  if (page.url().includes('/login')) { test.skip(); return }

  // Select "Modern" in the VorlageAuswahl dropdown
  const vorlagenSelect = page.locator('select[id="vorlage-auswahl"], [data-radix-select-trigger], #vorlage-auswahl').first()
  // Use the shadcn Select component
  await page.getByRole('combobox', { name: 'vorlage-auswahl' }).click().catch(() => {})
  const selectTrigger = page.locator('[id="vorlage-auswahl"]')
  await selectTrigger.click()
  await page.getByRole('option', { name: /Modern/ }).click()
  await page.waitForTimeout(500)

  // PATCH should be called for vorlage_id update; PUT should NOT (no new version)
  expect(patchCalled).toBe(true)
  expect(putCalled).toBe(false)
})

// ─────────────────────────────────────────────────────────────────────────────
// AC-6: Mindestens 2 Default-Templates vorhanden
// ─────────────────────────────────────────────────────────────────────────────

test('AC-6: API gibt mindestens 2 Templates zurück (Professionell + Modern)', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Professionell')).toBeVisible()
  await expect(page.getByText('Modern')).toBeVisible()

  // Both are visible = min 2 templates
  const count = await page.getByRole('button', { name: 'Bearbeiten' }).count()
  expect(count).toBeGreaterThanOrEqual(2)
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test('EC-1: Kontrast-Warnung erscheint bei zu heller Primärfarbe (#eeeeee)', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  // Clear and fill with light color (bad contrast against white bg)
  const hexInput = page.getByLabel('Primärfarbe (HEX)')
  await hexInput.click({ clickCount: 3 })
  await hexInput.fill('#eeeeee')
  await hexInput.blur()

  await expect(page.getByText(/Lesbarkeit/i)).toBeVisible({ timeout: 5000 })
})

test('EC-2: Keine Kontrast-Warnung bei guter Primärfarbe (#1a1a1a)', async ({ page }) => {
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  const hexInput = page.getByLabel('Primärfarbe (HEX)')
  await hexInput.click({ clickCount: 3 })
  await hexInput.fill('#1a1a1a')
  await hexInput.blur()

  await expect(page.getByText(/Lesbarkeit/i)).not.toBeVisible({ timeout: 5000 })
})

test('EC-3: Löschen zeigt Fehler wenn Vorlage von Berichten verwendet wird', async ({ page }) => {
  await setupAdminVorlagenMocks(page)

  // Mock DELETE to return 409 (template in use)
  await page.route('**/api/templates/00000000-0000-0000-0001-000000000002', async (r) => {
    if (r.request().method() === 'DELETE') {
      r.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Diese Vorlage wird von 3 Bericht(en) verwendet und kann nicht gelöscht werden.' }),
      })
    } else {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VORLAGEN[1]) })
    }
  })

  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  // Open dropdown for Modern (not standard)
  await page.getByRole('button', { name: 'Aktionen' }).nth(1).click()
  await page.getByRole('menuitem', { name: 'Löschen' }).click()

  // Confirm in dialog
  await page.getByRole('button', { name: 'Löschen' }).last().click()
  await page.waitForTimeout(300)

  // Error message should appear
  await expect(page.getByText(/3 Bericht/)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// Responsive Design Checks
// ─────────────────────────────────────────────────────────────────────────────

test('RESPONSIVE-1: Vorlagenliste rendert auf 375px (Mobile)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByText('Berichtsvorlagen')).toBeVisible()
})

test('RESPONSIVE-2: Vorlagen-Editor rendert auf 768px (Tablet)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await setupAdminVorlagenMocks(page)
  await page.goto('/admin/vorlagen/neu')
  if (page.url().includes('/login')) { test.skip(); return }

  await expect(page.getByLabel('Name *')).toBeVisible()
})
